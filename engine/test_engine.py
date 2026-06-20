"""Correctness test: the transformer engine must reproduce the reference CA's
biology. Transitions are stochastic, so we don't assert grid equality — we assert
the tumor_fraction trajectory and the phase-transition curve match within
tolerance. If the curves overlay, the transformer faithfully implements the
biology.

    python -m engine.test_engine
"""

from __future__ import annotations

import numpy as np
import torch

from engine.params import CAParams
from engine.reference_ca import run as ref_run, tumor_fraction as ref_frac
from engine.ca_transformer import TissueTransformer


def transformer_final_fraction(p: CAParams, H, W, steps, seed) -> float:
    eng = TissueTransformer(H, W, p, device=torch.device("cpu"))
    eng.reset(seed=seed, B=1, params=p)
    for _ in range(steps):
        eng.step()
    return eng.tumor_fraction()[0]


def test_phase_curves_overlay(H=48, W=48, steps=180, n_points=11, n_seeds=2, tol=0.18):
    aggr_values = np.linspace(0.0, 1.0, n_points)
    base = CAParams()
    print(f"\n{'aggression':>11} | {'reference':>10} | {'transformer':>12} | diff")
    print("-" * 52)
    max_diff = 0.0
    ref_curve, tf_curve = [], []
    for a in aggr_values:
        p = CAParams(aggression=float(a), immune=base.immune,
                     mutation=base.mutation, o_source=base.o_source)
        ref_vals = [ref_frac(ref_run(p, H, W, steps, seed=s)[0]) for s in range(n_seeds)]
        tf_vals = [transformer_final_fraction(p, H, W, steps, seed=s) for s in range(n_seeds)]
        rm, tm = float(np.mean(ref_vals)), float(np.mean(tf_vals))
        d = abs(rm - tm)
        max_diff = max(max_diff, d)
        ref_curve.append(rm)
        tf_curve.append(tm)
        print(f"{a:>11.3f} | {rm:>10.4f} | {tm:>12.4f} | {d:.4f}")
    print("-" * 52)
    print(f"max |reference - transformer| = {max_diff:.4f}  (tol {tol})")

    # both must show the same qualitative transition
    ref_jump = max(np.diff(ref_curve))
    tf_jump = max(np.diff(tf_curve))
    ok = (max_diff < tol) and (ref_jump > 0.15) and (tf_jump > 0.15)
    print(f"Reference knee jump={ref_jump:.3f}, transformer knee jump={tf_jump:.3f}")
    print(f"RESULT: {'PASS - curves overlay, transformer implements the biology' if ok else 'FAIL'}\n")
    assert ok, "transformer curve does not match reference within tolerance"
    return ok


def test_attention_aggregates_are_exact():
    """The uniform attention head must compute neighbor counts exactly."""
    from engine.ca_transformer import NeighborhoodAttention, _onehot_states
    from engine.reference_ca import _neighbor_counts
    torch.manual_seed(0)
    H = W = 16
    s = torch.randint(0, 4, (1, H, W), dtype=torch.uint8)
    o = torch.rand((1, 1, H, W))
    att = NeighborhoodAttention(device=torch.device("cpu"))
    oh = _onehot_states(s)
    n_counts, o_lap, _ = att.aggregates(oh, o)
    s_np = s[0].numpy()
    for t in range(4):
        ref = _neighbor_counts((s_np == t).astype(np.uint8) * 0 + s_np, t) if False else None
    # compare tumor counts (type 2) against numpy reference
    from engine.params import TUMOR, HEALTHY, EMPTY
    for t, name in [(EMPTY, "empty"), (HEALTHY, "healthy"), (TUMOR, "tumor")]:
        ref_c = _neighbor_counts(s_np, t)
        got = n_counts[0, t].numpy()
        err = np.abs(ref_c - got).max()
        print(f"attention neighbor-count[{name}] max err vs numpy: {err:.6f}")
        assert err < 1e-4, f"attention count for {name} not exact"
    print("Attention aggregates are exact.\n")


if __name__ == "__main__":
    test_attention_aggregates_are_exact()
    test_phase_curves_overlay()
