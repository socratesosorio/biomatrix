"""The parameter sweep — the "near-infinite compute" asset.

One batched GPU run: B = res*res grids, each a different (AGGRESSION, IMMUNE),
stepped ALL in parallel, final tumor_fraction per grid -> res*res phase diagram.
Literally "thousands of forward passes in parallel." On a multi-GPU box the grid
points are sharded across every visible GPU (run_auto).
"""

from __future__ import annotations

import numpy as np
import torch

from engine.params import CAParams, SweepConfig, TUMOR, NECROTIC, EMPTY, HEALTHY
from engine.ca_transformer import TissueTransformer, pick_device, _onehot_states


@torch.no_grad()
def _simulate_points(a_vals: np.ndarray, b_vals: np.ndarray, base: CAParams,
                     cfg: SweepConfig, device, seed: int = 12345,
                     progress=None) -> np.ndarray:
    """Run len(a_vals) grids in one batch on `device`. a_vals/b_vals are the
    per-grid values of axis_a/axis_b. Returns final tumor_fraction per grid."""
    B = len(a_vals)
    if B == 0:
        return np.zeros(0, dtype=np.float32)
    g = cfg.grid
    eng = TissueTransformer(g, g, base, device=device)
    eng.reset(seed=seed, B=B, tumor_radius=2, params=base)

    # build per-grid parameter tensors for whichever axes the sweep varies
    pa = torch.from_numpy(a_vals.astype(np.float32)).to(device).view(B, 1, 1)
    pb = torch.from_numpy(b_vals.astype(np.float32)).to(device).view(B, 1, 1)

    def axis_tensor(name, default):
        if cfg.axis_a == name:
            return pa
        if cfg.axis_b == name:
            return pb
        return torch.full((B, 1, 1), float(getattr(base, name)), device=device)

    aggression = axis_tensor("aggression", base.aggression)
    immune = axis_tensor("immune", base.immune)
    mutation = axis_tensor("mutation", base.mutation)
    o_source = axis_tensor("o_source", base.o_source)

    p = base
    for it in range(cfg.steps):
        state = eng.state
        oxygen = eng.oxygen.unsqueeze(1)
        onehot = _onehot_states(state)
        n_counts, o_lap, _ = eng.attn.aggregates(onehot, oxygen)
        n_healthy = n_counts[:, HEALTHY]
        n_tumor = n_counts[:, TUMOR]
        crowding = n_counts[:, HEALTHY] + n_counts[:, TUMOR]

        consume = torch.zeros_like(oxygen[:, 0])
        consume = torch.where(state == HEALTHY, torch.full_like(consume, p.consume_healthy), consume)
        consume = torch.where(state == TUMOR, torch.full_like(consume, p.consume_tumor), consume)
        o_next = torch.clamp(
            oxygen[:, 0] + p.o_diff * o_lap[:, 0] - consume + o_source.view(B, 1, 1),
            0.0, 1.0,
        )

        r = torch.rand(state.shape, generator=eng._gen).to(device)
        nxt = state.clone()

        empty = state == EMPTY
        p_to_tumor = torch.clamp(aggression * (n_tumor / 8.0), 0.0, 1.0)
        to_tumor = empty & (n_tumor > 0) & (r < p_to_tumor)
        nxt[to_tumor] = TUMOR
        to_healthy = empty & (~to_tumor) & (n_healthy > 0) & (crowding < p.inhib) & (r < p.p_regrow)
        nxt[to_healthy] = HEALTHY

        healthy = state == HEALTHY
        h_necro = healthy & (o_next < p.o_necro)
        nxt[h_necro] = NECROTIC
        h_left = healthy & (~h_necro)
        h_mut = h_left & (r < mutation)
        nxt[h_mut] = TUMOR
        h_left2 = h_left & (~h_mut)
        p_invade = torch.clamp(aggression * p.p_invade * (n_tumor / 8.0), 0.0, 1.0)
        h_invade = h_left2 & (n_tumor > 0) & (r < p_invade)
        nxt[h_invade] = TUMOR

        tumor = state == TUMOR
        t_necro = tumor & (o_next < p.o_necro)
        nxt[t_necro] = NECROTIC
        t_left = tumor & (~t_necro)
        t_clear = t_left & (r < immune)
        nxt[t_clear] = EMPTY

        eng.state = nxt
        eng.oxygen = o_next
        if progress and it % 25 == 0:
            progress(it, cfg.steps)

    s = eng.state
    final = ((s == TUMOR) | (s == NECROTIC)).float().mean(dim=(1, 2))
    return final.cpu().numpy().astype(np.float32)


def _meshgrid(cfg: SweepConfig):
    a_lin = np.linspace(cfg.range_a[0], cfg.range_a[1], cfg.res)
    b_lin = np.linspace(cfg.range_b[0], cfg.range_b[1], cfg.res)
    AA, BB = np.meshgrid(a_lin, b_lin, indexing="xy")  # rows=b, cols=a
    return AA.reshape(-1), BB.reshape(-1)


def _pack(cfg: SweepConfig, grid_flat: np.ndarray) -> dict:
    return {
        "axisA": cfg.axis_a,
        "rangeA": list(cfg.range_a),
        "axisB": cfg.axis_b,
        "rangeB": list(cfg.range_b),
        "res": cfg.res,
        "grid": grid_flat.astype(np.float32).reshape(-1).tolist(),
    }


@torch.no_grad()
def run(cfg: SweepConfig | None = None, base: CAParams | None = None,
        device=None, progress=None) -> dict:
    cfg = cfg or SweepConfig()
    base = base or CAParams()
    device = device or pick_device()
    fa, fb = _meshgrid(cfg)
    final = _simulate_points(fa, fb, base, cfg, device, progress=progress)
    return _pack(cfg, final)


@torch.no_grad()
def run_auto(cfg: SweepConfig | None = None, base: CAParams | None = None,
             progress=None) -> dict:
    """Shard the grid points across every visible CUDA device; fall back to a
    single device otherwise."""
    cfg = cfg or SweepConfig()
    base = base or CAParams()
    n_gpu = torch.cuda.device_count() if torch.cuda.is_available() else 0
    if n_gpu <= 1:
        return run(cfg, base, progress=progress)

    fa, fb = _meshgrid(cfg)
    chunks_a = np.array_split(fa, n_gpu)
    chunks_b = np.array_split(fb, n_gpu)
    results = [None] * n_gpu

    import threading
    def work(i):
        dev = torch.device(f"cuda:{i}")
        results[i] = _simulate_points(chunks_a[i], chunks_b[i], base, cfg, dev)

    threads = [threading.Thread(target=work, args=(i,)) for i in range(n_gpu)]
    for th in threads:
        th.start()
    for th in threads:
        th.join()
    final = np.concatenate(results)
    return _pack(cfg, final)


if __name__ == "__main__":
    import time
    from engine.params import SWEEP
    t0 = time.time()
    out = run_auto(SWEEP, progress=lambda i, n: print(f"  step {i}/{n}", end="\r"))
    dt = time.time() - t0
    arr = np.array(out["grid"]).reshape(out["res"], out["res"])
    ng = torch.cuda.device_count() if torch.cuda.is_available() else 0
    print(f"\nSwept {out['res']}x{out['res']} = {out['res']**2} grids in {dt:.2f}s "
          f"on {'%d GPU(s)' % ng if ng else pick_device()}")
    print(f"tumor_fraction range: {arr.min():.3f} .. {arr.max():.3f}")
    chars = " .:-=+*#%@"
    print("\naggression -->   (rows: immune)")
    for row in arr:
        print("".join(chars[min(len(chars) - 1, int(v * (len(chars) - 1) + 0.5))] for v in row))
