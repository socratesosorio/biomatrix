"""CAParams dataclass + presets for the tissue simulation.

The phase transition lives here: fix IMMUNE, sweep AGGRESSION. Below a critical
aggression the immune system + contact inhibition hold tumor_fraction ~ 0; above
it, proliferation outruns clearance and the tissue runs away to cancer.

Numbers below were tuned by engine/reference_ca.py's verification sweep so the
knee of the sigmoid sits at a convenient slider position (~0.55 aggression).
"""

from __future__ import annotations

from dataclasses import dataclass, asdict, replace


# Cell states
EMPTY = 0
HEALTHY = 1
TUMOR = 2
NECROTIC = 3
# --- virus agent states (additive) ---
EXPOSED = 4
INFECTIOUS = 5
VIRAL_DEAD = 6

NUM_STATES = 7

STATE_NAMES = {
    EMPTY: "EMPTY", HEALTHY: "HEALTHY", TUMOR: "TUMOR", NECROTIC: "NECROTIC",
    EXPOSED: "EXPOSED", INFECTIOUS: "INFECTIOUS", VIRAL_DEAD: "VIRAL_DEAD",
}


@dataclass
class CAParams:
    # --- the two hero knobs ---
    aggression: float = 0.62   # proliferation / invasion strength (the phase knob)
    immune: float = 0.18       # immune clearance probability for TUMOR cells

    # --- secondary knobs (exposed as sliders) ---
    mutation: float = 0.0008   # spontaneous HEALTHY -> TUMOR per step
    o_source: float = 0.045    # uniform oxygen replenishment per step

    # --- oxygen dynamics ---
    o_diff: float = 0.18       # diffusion coefficient for laplacian8
    consume_healthy: float = 0.018
    consume_tumor: float = 0.085   # tumor consumes more -> hypoxic core
    o_necro: float = 0.10      # oxygen below this -> NECROTIC

    # --- proliferation / regrowth ---
    p_regrow: float = 0.06     # contact-inhibited regrowth of HEALTHY into EMPTY
    inhib: int = 6             # crowding >= inhib blocks regrowth
    p_invade: float = 0.55     # base rate tumor invades adjacent HEALTHY (scaled by aggression)

    # --- virus agent (additive; does not affect cancer rules) ---
    infectivity: float = 0.28   # HEALTHY->EXPOSED scale (n_infectious/8 + viral_load)
    latent_period: int = 6      # ticks EXPOSED before turning INFECTIOUS
    viral_diff: float = 0.16    # viral-load diffusion (same laplacian as oxygen)
    viral_decay: float = 0.08   # viral-load decay per tick
    viral_emit: float = 0.6     # viral-load emitted by each INFECTIOUS cell per tick
    burst_period: int = 10      # ticks INFECTIOUS before VIRAL_DEAD

    # --- runtime / engine ---
    speed: int = 30            # ticks per second target

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "CAParams":
        fields = {f for f in cls.__dataclass_fields__}  # type: ignore[attr-defined]
        clean = {k: v for k, v in d.items() if k in fields}
        return cls(**clean)

    def merged(self, updates: dict) -> "CAParams":
        fields = {f for f in self.__dataclass_fields__}
        clean = {k: v for k, v in updates.items() if k in fields and v is not None}
        return replace(self, **clean)


# The recorded hero run: aggression just above critical (~0.35), blooms with a
# necrotic core over ~30s, immune visible but losing.
MONEY_SHOT = CAParams(
    aggression=0.48,
    immune=0.18,
    mutation=0.0008,
    o_source=0.042,
)

# Right at the knee: tiny fluctuations decide extinction vs explosion -> two
# seeds with identical params diverge. The "chaos, shown rigorously" beat.
NEAR_CRITICAL = CAParams(
    aggression=0.34,
    immune=0.18,
    mutation=0.0008,
    o_source=0.045,
)

# Homeostasis: immune + contact inhibition win, tumor stays suppressed.
HEALTHY_PRESET = CAParams(
    aggression=0.20,
    immune=0.30,
    mutation=0.0005,
    o_source=0.05,
)


# Phase-map sweep configuration. res x res grids, each a different
# (aggression, immune) point, all stepped in parallel on one GPU.
@dataclass
class SweepConfig:
    axis_a: str = "aggression"
    range_a: tuple = (0.0, 1.0)
    axis_b: str = "immune"
    range_b: tuple = (0.0, 0.5)
    res: int = 24
    steps: int = 200
    grid: int = 48      # H=W per sub-grid in the sweep (kept small; B = res*res)


SWEEP = SweepConfig()


PRESETS = {
    "MONEY_SHOT": MONEY_SHOT,
    "NEAR_CRITICAL": NEAR_CRITICAL,
    "HEALTHY": HEALTHY_PRESET,
}
