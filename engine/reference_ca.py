"""NumPy reference cellular automaton + a script that proves the phase
transition is real. Build & verify this FIRST — it de-risks the science before
any GPU or UI work.

Run directly to produce the verification sweep:

    python -m engine.reference_ca            # sweep aggression, print the knee
    python -m engine.reference_ca --plot     # also save phase_transition.png
"""

from __future__ import annotations

import argparse

import numpy as np

from engine.params import (
    CAParams,
    EMPTY,
    HEALTHY,
    TUMOR,
    NECROTIC,
)


def make_grid(H: int, W: int, seed: int, tumor_radius: int = 3):
    """Healthy tissue with a small tumor seed at the center, full oxygen."""
    rng = np.random.default_rng(seed)
    state = np.full((H, W), HEALTHY, dtype=np.uint8)
    # a little empty space so regrowth/proliferation has somewhere to go
    empties = rng.random((H, W)) < 0.04
    state[empties] = EMPTY

    cy, cx = H // 2, W // 2
    yy, xx = np.ogrid[:H, :W]
    disc = (yy - cy) ** 2 + (xx - cx) ** 2 <= tumor_radius**2
    state[disc] = TUMOR

    oxygen = np.ones((H, W), dtype=np.float32)
    return state, oxygen


def laplacian8(O: np.ndarray) -> np.ndarray:
    """8-neighbor laplacian with reflective (edge) padding."""
    P = np.pad(O, 1, mode="edge")
    neigh = (
        P[:-2, :-2] + P[:-2, 1:-1] + P[:-2, 2:]
        + P[1:-1, :-2] + P[1:-1, 2:]
        + P[2:, :-2] + P[2:, 1:-1] + P[2:, 2:]
    )
    return neigh - 8.0 * O


def _neighbor_counts(state: np.ndarray, target: int) -> np.ndarray:
    m = (state == target).astype(np.int32)
    P = np.pad(m, 1, mode="constant")
    return (
        P[:-2, :-2] + P[:-2, 1:-1] + P[:-2, 2:]
        + P[1:-1, :-2] + P[1:-1, 2:]
        + P[2:, :-2] + P[2:, 1:-1] + P[2:, 2:]
    )


def step(state: np.ndarray, oxygen: np.ndarray, p: CAParams, rng: np.random.Generator):
    """One synchronous update. Returns (next_state, next_oxygen)."""
    H, W = state.shape

    # --- oxygen update: diffusion + consumption + uniform source ---
    consume = np.zeros_like(oxygen)
    consume[state == HEALTHY] = p.consume_healthy
    consume[state == TUMOR] = p.consume_tumor
    O_next = np.clip(
        oxygen + p.o_diff * laplacian8(oxygen) - consume + p.o_source,
        0.0,
        1.0,
    ).astype(np.float32)

    # --- neighbor aggregates (computed from CURRENT state) ---
    n_empty = _neighbor_counts(state, EMPTY)
    n_healthy = _neighbor_counts(state, HEALTHY)
    n_tumor = _neighbor_counts(state, TUMOR)
    crowding = n_healthy + n_tumor

    r = rng.random((H, W)).astype(np.float32)
    next_state = state.copy()

    # --- EMPTY ---
    empty = state == EMPTY
    to_tumor = empty & (n_tumor > 0) & (r < p.aggression * (n_tumor / 8.0))
    next_state[to_tumor] = TUMOR
    to_healthy = (
        empty & ~to_tumor & (n_healthy > 0) & (crowding < p.inhib) & (r < p.p_regrow)
    )
    next_state[to_healthy] = HEALTHY

    # --- HEALTHY ---
    healthy = state == HEALTHY
    h_necro = healthy & (O_next < p.o_necro)
    next_state[h_necro] = NECROTIC
    h_left = healthy & ~h_necro
    h_mut = h_left & (r < p.mutation)
    next_state[h_mut] = TUMOR
    h_left2 = h_left & ~h_mut
    h_invade = h_left2 & (n_tumor > 0) & (r < p.aggression * p.p_invade * (n_tumor / 8.0))
    next_state[h_invade] = TUMOR

    # --- TUMOR ---
    tumor = state == TUMOR
    t_necro = tumor & (O_next < p.o_necro)
    next_state[t_necro] = NECROTIC
    t_left = tumor & ~t_necro
    t_clear = t_left & (r < p.immune)
    next_state[t_clear] = EMPTY

    # --- NECROTIC stays necrotic (persistent dead core) ---

    return next_state, O_next


def tumor_fraction(state: np.ndarray) -> float:
    return float(np.count_nonzero((state == TUMOR) | (state == NECROTIC))) / state.size


def run(p: CAParams, H: int, W: int, steps: int, seed: int):
    state, oxygen = make_grid(H, W, seed)
    rng = np.random.default_rng(seed * 7919 + 1)
    for _ in range(steps):
        state, oxygen = step(state, oxygen, p, rng)
    return state, oxygen


def verify(H=64, W=64, steps=250, n_seeds=3, n_points=21, plot=False):
    """Sweep AGGRESSION, print final tumor_fraction vs aggression. Looking for a
    clean sigmoid/knee that proves the transition is real and f."""
    base = CAParams()
    aggr_values = np.linspace(0.0, 1.0, n_points)
    results = []
    print(f"\nPhase-transition sweep  (immune={base.immune}, {H}x{W}, {steps} steps, "
          f"{n_seeds} seeds)\n")
    print(f"{'aggression':>11} | {'mean tumor_frac':>15} | sigmoid")
    print("-" * 52)
    for a in aggr_values:
        p = CAParams(aggression=float(a), immune=base.immune,
                     mutation=base.mutation, o_source=base.o_source)
        fracs = [tumor_fraction(run(p, H, W, steps, seed=s)[0]) for s in range(n_seeds)]
        mean = float(np.mean(fracs))
        results.append((float(a), mean, fracs))
        bar = "#" * int(round(mean * 40))
        print(f"{a:>11.3f} | {mean:>15.4f} | {bar}")

    fracs_arr = np.array([m for _, m, _ in results])
    # crude knee detection: largest jump between consecutive points
    diffs = np.diff(fracs_arr)
    knee_idx = int(np.argmax(diffs))
    knee_a = aggr_values[knee_idx]
    low = fracs_arr[: max(1, knee_idx)].mean()
    high = fracs_arr[knee_idx + 1:].mean() if knee_idx + 1 < len(fracs_arr) else fracs_arr[-1]
    print("-" * 52)
    print(f"Knee near aggression={knee_a:.3f}  "
          f"(low side mean={low:.3f}, high side mean={high:.3f}, jump={diffs[knee_idx]:.3f})")
    crisp = (low < 0.15) and (high > 0.45) and (diffs[knee_idx] > 0.15)
    print(f"Crisp transition: {'YES' if crisp else 'NO — retune'}\n")

    if plot:
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt

            plt.figure(figsize=(6, 4))
            plt.plot(aggr_values, fracs_arr, "o-", color="crimson")
            plt.axvline(knee_a, color="gray", ls="--", label=f"knee~{knee_a:.2f}")
            plt.xlabel("AGGRESSION")
            plt.ylabel("final tumor_fraction")
            plt.title("Phase transition: homeostasis -> runaway cancer")
            plt.legend()
            plt.tight_layout()
            plt.savefig("phase_transition.png", dpi=110)
            print("Saved phase_transition.png")
        except ImportError:
            print("(matplotlib not installed; skipping plot)")

    return results, crisp


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--plot", action="store_true")
    ap.add_argument("--steps", type=int, default=250)
    ap.add_argument("--grid", type=int, default=64)
    args = ap.parse_args()
    verify(H=args.grid, W=args.grid, steps=args.steps, plot=args.plot)
