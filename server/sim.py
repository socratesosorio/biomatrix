"""Transport-agnostic simulation core. Holds the engine + control state and a
`handle(msg)` that mutates it; the websocket transport (server.py or app.py)
owns the client set, broadcasting, and sweep execution.
"""

from __future__ import annotations

import json
import os

from engine.params import CAParams, PRESETS, SWEEP, MONEY_SHOT, SweepConfig
from engine.ca_transformer import TissueTransformer, pick_device
from server.protocol import encode_frame


GRID = int(os.environ.get("CA_GRID", "128"))


class SimState:
    def __init__(self, grid: int = GRID):
        self.grid = grid
        self.device = pick_device()
        self.params = CAParams(**MONEY_SHOT.to_dict())
        self.engine = TissueTransformer(grid, grid, self.params, device=self.device)
        self.engine.reset(seed=1, B=1, params=self.params)
        self.playing = True
        self.ticks_per_sec = self.params.speed
        self.seed = 1
        self.split = False
        self.focus = None  # (x, y) or None

    # ---- encoding ----
    def build_frame(self) -> bytes:
        eng = self.engine
        state = eng.state_numpy()
        oxygen = eng.oxygen_numpy()
        focus_block = None
        if self.focus is not None:
            fx = max(0, min(self.grid - 1, self.focus[0]))
            fy = max(0, min(self.grid - 1, self.focus[1]))
            attn = eng.focus_attention(fx, fy, b=0)
            focus_block = (fx, fy, attn)
        return encode_frame(eng.tick, state, oxygen, focus_block)

    def build_stats(self) -> str:
        return json.dumps({
            "type": "stats",
            "tick": self.engine.tick,
            "tumor_fraction": self.engine.tumor_fraction(),
            "necrotic_fraction": self.engine.necrotic_fraction(),
            "infected_fraction": self.engine.infected_fraction(),
        })

    def hello(self) -> str:
        return json.dumps({
            "type": "hello",
            "grid": self.grid,
            "device": str(self.device),
            "gpus": self._gpu_info(),
            "params": self.params.to_dict(),
            "playing": self.playing,
        })

    def _gpu_info(self):
        try:
            import torch
            if torch.cuda.is_available():
                return [torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())]
        except Exception:
            pass
        return []

    def step(self):
        self.engine.step()

    # ---- control handling ----
    # returns (broadcast_now: bool, sweep_cfg: SweepConfig | None)
    def handle(self, msg: dict):
        t = msg.get("type")
        if t == "set_params":
            self.params = self.params.merged(msg.get("params", {}))
            self.engine.params = self.params
            return False, None
        if t == "preset":
            preset = PRESETS.get(msg.get("name", "MONEY_SHOT"), MONEY_SHOT)
            self.params = CAParams(**preset.to_dict())
            self.engine.params = self.params
            self.engine.reset(seed=self.seed, B=2 if self.split else 1, params=self.params)
            return True, None
        if t == "reset":
            self.seed = int(msg.get("seed", self.seed))
            if msg.get("params"):
                self.params = self.params.merged(msg["params"])
                self.engine.params = self.params
            self.engine.reset(seed=self.seed, B=2 if self.split else 1, params=self.params)
            return True, None
        if t == "play":
            self.playing = True
            return False, None
        if t == "pause":
            self.playing = False
            return False, None
        if t == "set_speed":
            self.ticks_per_sec = int(msg.get("ticks_per_sec", 30))
            return False, None
        if t == "spawn":
            self.engine.spawn(
                int(msg.get("x", self.grid // 2)),
                int(msg.get("y", self.grid // 2)),
                int(msg.get("radius", 4)),
            )
            return True, None
        if t == "release_virus":
            self.engine.release_virus(
                int(msg.get("x", self.grid // 2)),
                int(msg.get("y", self.grid // 2)),
                int(msg.get("radius", 4)),
            )
            return True, None
        if t == "focus":
            self.focus = None if msg.get("clear") else (int(msg.get("x", 0)), int(msg.get("y", 0)))
            return False, None
        if t == "split":
            self.split = bool(msg.get("on"))
            self.engine.reset(seed=self.seed, B=2 if self.split else 1, params=self.params)
            return True, None
        if t == "sweep":
            cfg = SweepConfig(
                axis_a=msg.get("axisA", SWEEP.axis_a),
                range_a=tuple(msg.get("rangeA", SWEEP.range_a)),
                axis_b=msg.get("axisB", SWEEP.axis_b),
                range_b=tuple(msg.get("rangeB", SWEEP.range_b)),
                res=int(msg.get("res", SWEEP.res)),
                steps=int(msg.get("steps", SWEEP.steps)),
                grid=int(os.environ.get("CA_SWEEP_GRID", SWEEP.grid)),
            )
            return False, cfg
        return False, None
