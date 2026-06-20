"""Standalone asyncio WebSocket server (local dev). One sim loop steps the
engine; the WS handler streams binary frames and ingests control messages.

Run:  python -m server.server
Env:  CA_DEVICE=cpu|mps|cuda  CA_GRID=128  CA_PORT=8000  CA_HOST=localhost
"""

from __future__ import annotations

import asyncio
import json
import os
import functools

import websockets

from engine.sweep import run_auto as sweep_run
from server.sim import SimState, GRID

HOST = os.environ.get("CA_HOST", "localhost")
PORT = int(os.environ.get("CA_PORT", "8000"))

SIM = SimState(GRID)
CLIENTS: set = set()
SWEEP_LOCK = asyncio.Lock()


async def broadcast(message):
    if not CLIENTS:
        return
    dead = []
    for ws in list(CLIENTS):
        try:
            await ws.send(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        CLIENTS.discard(ws)


async def sim_loop():
    while True:
        if SIM.playing and CLIENTS:
            SIM.step()
            await broadcast(SIM.build_frame())
            if SIM.engine.tick % 3 == 0:
                await broadcast(SIM.build_stats())
        await asyncio.sleep(1.0 / max(1, SIM.ticks_per_sec))


async def run_sweep(cfg):
    if SWEEP_LOCK.locked():
        return
    async with SWEEP_LOCK:
        await broadcast(json.dumps({"type": "ack", "what": "sweep_started"}))
        loop = asyncio.get_running_loop()
        fn = functools.partial(sweep_run, cfg, SIM.params)
        result = await loop.run_in_executor(None, fn)
        result["type"] = "sweep_result"
        await broadcast(json.dumps(result))


async def handler(ws):
    CLIENTS.add(ws)
    try:
        await ws.send(SIM.hello())
        await ws.send(SIM.build_frame())
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                continue
            broadcast_now, sweep_cfg = SIM.handle(msg)
            if broadcast_now:
                await broadcast(SIM.build_frame())
            if sweep_cfg is not None:
                asyncio.create_task(run_sweep(sweep_cfg))
    except websockets.ConnectionClosed:
        pass
    finally:
        CLIENTS.discard(ws)


async def main():
    print(f"Tissue server ws://{HOST}:{PORT}  grid={SIM.grid}x{SIM.grid}  device={SIM.device}")
    asyncio.create_task(sim_loop())
    async with websockets.serve(handler, HOST, PORT, max_size=None):
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nbye")
