"""Tissue as a neighborhood-attention transformer.

Every timestep is a transformer forward pass: windowed (3x3) attention gathers
each cell's neighborhood, a uniform-attention head computes the neighbor type
fractions and the oxygen Laplacian (exactly the aggregates the biology needs),
and the MLP-as-transition-function maps [self, neighbor-aggregates] -> next-state
logits + delta-oxygen. The next state is *sampled* from those logits — which is
literally LLM-style token sampling, on-theme for "inference-time compute =
sampling the forward pass."

A second, content-based attention head ("signaling") produces per-neighbor
weights that vary with neighbor type / oxygen — used to draw the live
cell-cell-signaling overlay at cell scale.

Everything carries a batch dim B so we can run many seeds at once:
  B=1 normal, B=2 split/chaos view, B=res*res for the phase-map sweep.
"""

from __future__ import annotations

import os

import numpy as np
import torch
import torch.nn.functional as F

from engine.params import CAParams, EMPTY, HEALTHY, TUMOR, NECROTIC


def pick_device() -> torch.device:
    override = os.environ.get("CA_DEVICE")
    if override:
        return torch.device(override)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


# 3x3 neighbor offsets, center first so token index 4 == self.
_OFFSETS = [(-1, -1), (-1, 0), (-1, 1),
            (0, -1),  (0, 0),  (0, 1),
            (1, -1),  (1, 0),  (1, 1)]
SELF_TOKEN = 4


def _onehot_states(state: torch.Tensor) -> torch.Tensor:
    """[B,H,W] uint8 -> [B,4,H,W] float one-hot of the 4 states."""
    B, H, W = state.shape
    oh = torch.zeros((B, 4, H, W), dtype=torch.float32, device=state.device)
    oh.scatter_(1, state.long().unsqueeze(1), 1.0)
    return oh


def _gather_neighborhood(field: torch.Tensor, pad_mode: str = "constant") -> torch.Tensor:
    """[B,C,H,W] -> [B,9,C,H,W]: the 3x3 windowed-attention token gather.

    This is the windowed-attention K/V gather (NAT-style / im2col). pad_mode
    "constant" (zero) makes out-of-grid neighbors the EMPTY/zero token — correct
    for state one-hots. "replicate" matches the reference oxygen laplacian's edge
    padding so the border doesn't spuriously go hypoxic.
    """
    P = F.pad(field, (1, 1, 1, 1), mode=pad_mode)
    H, W = field.shape[2], field.shape[3]
    toks = []
    for (dy, dx) in _OFFSETS:
        toks.append(P[:, :, 1 + dy:1 + dy + H, 1 + dx:1 + dx + W])
    return torch.stack(toks, dim=1)  # [B,9,C,H,W]


class NeighborhoodAttention:
    """Windowed attention over the 3x3 neighborhood.

    Two heads, both genuine softmax attention over the 9 tokens:
      * uniform head  -> exact neighbor aggregates (type counts, oxygen Laplacian)
      * signaling head -> content-based per-neighbor weights for the overlay
    Weights are hand-set (no training needed) — the heads compute closed-form
    aggregates, which is the whole point: biology's local rules ARE attention.
    """

    def __init__(self, d: int = 32, device=None):
        self.d = d
        self.device = device or torch.device("cpu")
        # token feature = [onehot(4), O(1)] -> value channels we read out
        # signaling head: query/key embeddings make low-oxygen + tumor neighbors
        # "shout". key_embed maps [onehot4, O] -> scalar score.
        # tumor neighbors and hypoxic neighbors get higher attention.
        self.k_state_weight = torch.tensor([0.0, 0.3, 2.5, 1.2], device=self.device)  # EMPTY,HEALTHY,TUMOR,NECROTIC
        self.k_oxygen_weight = -1.5  # lower oxygen -> louder signal
        self.temperature = 0.7

    def aggregates(self, onehot: torch.Tensor, oxygen: torch.Tensor):
        """Uniform-attention head. Returns exact neighbor aggregates.

        onehot: [B,4,H,W], oxygen: [B,1,H,W].
        -> n_counts [B,4,H,W] (neighbor counts per type, self excluded),
           o_lap   [B,1,H,W],
           o_neigh_mean [B,1,H,W].
        """
        # state one-hots: zero pad (outside grid contributes no type).
        # oxygen: replicate pad (matches reference laplacian's edge padding).
        oh_toks = _gather_neighborhood(onehot, pad_mode="constant")     # [B,9,4,H,W]
        o_toks = _gather_neighborhood(oxygen, pad_mode="replicate")     # [B,9,1,H,W]
        toks = torch.cat([oh_toks, o_toks], dim=2)          # [B,9,5,H,W]
        # uniform attention over 9 tokens == mean (softmax of zero logits)
        attn = torch.full((toks.shape[0], 9) + toks.shape[3:], 1.0 / 9.0,
                          device=toks.device)               # [B,9,H,W]
        out = (toks * attn.unsqueeze(2)).sum(dim=1)         # [B,5,H,W] = mean over 9
        sum9 = out * 9.0
        # neighbor counts (8-neighborhood) = sum over 9 - self
        n_counts = sum9[:, 0:4] - onehot                    # [B,4,H,W]
        o_self = oxygen
        o_sum9 = sum9[:, 4:5]
        o_lap = o_sum9 - 9.0 * o_self                       # laplacian8 (edge padded)
        o_neigh_mean = (o_sum9 - o_self) / 8.0
        return n_counts, o_lap, o_neigh_mean

    def signaling_weights(self, onehot: torch.Tensor, oxygen: torch.Tensor) -> torch.Tensor:
        """Content-based head: softmax(Q.K) per-neighbor weights. [B,9,H,W].

        Used purely for the cell-cell-signaling overlay; this is a real second
        attention head in the forward pass.
        """
        feat = torch.cat([onehot, oxygen], dim=1)           # [B,5,H,W]
        toks = _gather_neighborhood(feat)                   # [B,9,5,H,W]
        state_part = toks[:, :, 0:4]                        # [B,9,4,H,W]
        ox_part = toks[:, :, 4]                             # [B,9,H,W]
        score = torch.einsum("bnchw,c->bnhw", state_part, self.k_state_weight)
        score = score + self.k_oxygen_weight * ox_part
        attn = torch.softmax(score / self.temperature, dim=1)  # [B,9,H,W]
        return attn


class TissueTransformer:
    """The full per-timestep forward pass: attention block + transition MLP +
    sampling. Holds the grid state so the server can step it in place."""

    def __init__(self, H: int, W: int, params: CAParams, device=None,
                 d: int = 32, hidden: int = 64):
        self.device = device or pick_device()
        self.H, self.W = H, W
        self.params = params
        self.d = d
        self.hidden = hidden
        self.attn = NeighborhoodAttention(d=d, device=self.device)
        self.state = torch.empty((1, H, W), dtype=torch.uint8, device=self.device)
        self.oxygen = torch.empty((1, H, W), dtype=torch.float32, device=self.device)
        self.tick = 0
        self._gen = torch.Generator(device="cpu")  # cpu generator: portable across mps/cuda
        self.reset(seed=0)

    @property
    def B(self) -> int:
        return self.state.shape[0]

    # ---- grid setup ----
    def reset(self, seed: int = 0, B: int = 1, tumor_radius: int = 3, params: CAParams | None = None):
        if params is not None:
            self.params = params
        H, W = self.H, self.W
        self._gen.manual_seed(int(seed) * 2654435761 % (2**31))
        rng = np.random.default_rng(seed)
        states = []
        oxys = []
        for b in range(B):
            srng = np.random.default_rng(seed + b * 104729)
            s = np.full((H, W), HEALTHY, dtype=np.uint8)
            s[srng.random((H, W)) < 0.04] = EMPTY
            cy, cx = H // 2, W // 2
            yy, xx = np.ogrid[:H, :W]
            disc = (yy - cy) ** 2 + (xx - cx) ** 2 <= tumor_radius**2
            s[disc] = TUMOR
            states.append(s)
            oxys.append(np.ones((H, W), dtype=np.float32))
        self.state = torch.from_numpy(np.stack(states)).to(self.device)
        self.oxygen = torch.from_numpy(np.stack(oxys)).to(self.device)
        self.tick = 0

    def set_batch(self, B: int, seed: int = 0):
        self.reset(seed=seed, B=B)

    def spawn(self, x: int, y: int, radius: int = 4, b: int | None = None):
        H, W = self.H, self.W
        yy, xx = torch.meshgrid(
            torch.arange(H, device=self.device),
            torch.arange(W, device=self.device),
            indexing="ij",
        )
        disc = (yy - y) ** 2 + (xx - x) ** 2 <= radius**2
        if b is None:
            self.state[:, disc] = TUMOR
        else:
            self.state[b, disc] = TUMOR

    # ---- the forward pass ----
    @torch.no_grad()
    def step(self):
        p = self.params
        state = self.state
        oxygen = self.oxygen.unsqueeze(1)        # [B,1,H,W]
        onehot = _onehot_states(state)           # [B,4,H,W]

        # === ATTENTION BLOCK ===
        n_counts, o_lap, _o_neigh = self.attn.aggregates(onehot, oxygen)
        n_empty = n_counts[:, EMPTY]
        n_healthy = n_counts[:, HEALTHY]
        n_tumor = n_counts[:, TUMOR]
        crowding = n_healthy + n_tumor

        # === MLP TRANSITION (oxygen channel) ===
        consume = torch.zeros_like(oxygen[:, 0])
        consume = torch.where(state == HEALTHY, torch.full_like(consume, p.consume_healthy), consume)
        consume = torch.where(state == TUMOR, torch.full_like(consume, p.consume_tumor), consume)
        o_next = torch.clamp(
            oxygen[:, 0] + p.o_diff * o_lap[:, 0] - consume + p.o_source, 0.0, 1.0
        )

        # === MLP TRANSITION (state logits) -> SAMPLE ===
        # One uniform draw per (b,h,w), same nested-threshold structure as the
        # reference, so the tumor_fraction trajectory and phase curve match.
        r = torch.rand(state.shape, generator=self._gen).to(self.device)
        nxt = state.clone()

        empty = state == EMPTY
        p_to_tumor = torch.clamp(p.aggression * (n_tumor / 8.0), 0.0, 1.0)
        to_tumor = empty & (n_tumor > 0) & (r < p_to_tumor)
        nxt[to_tumor] = TUMOR
        to_healthy = empty & (~to_tumor) & (n_healthy > 0) & (crowding < p.inhib) & (r < p.p_regrow)
        nxt[to_healthy] = HEALTHY

        healthy = state == HEALTHY
        h_necro = healthy & (o_next < p.o_necro)
        nxt[h_necro] = NECROTIC
        h_left = healthy & (~h_necro)
        h_mut = h_left & (r < p.mutation)
        nxt[h_mut] = TUMOR
        h_left2 = h_left & (~h_mut)
        p_invade = torch.clamp(p.aggression * p.p_invade * (n_tumor / 8.0), 0.0, 1.0)
        h_invade = h_left2 & (n_tumor > 0) & (r < p_invade)
        nxt[h_invade] = TUMOR

        tumor = state == TUMOR
        t_necro = tumor & (o_next < p.o_necro)
        nxt[t_necro] = NECROTIC
        t_left = tumor & (~t_necro)
        t_clear = t_left & (r < p.immune)
        nxt[t_clear] = EMPTY

        # NECROTIC persists.

        self.state = nxt
        self.oxygen = o_next
        self.tick += 1
        return self.state, self.oxygen

    # ---- readouts ----
    def tumor_fraction(self) -> list[float]:
        s = self.state
        frac = ((s == TUMOR) | (s == NECROTIC)).float().mean(dim=(1, 2))
        return frac.cpu().tolist()

    def necrotic_fraction(self) -> list[float]:
        s = self.state
        frac = (s == NECROTIC).float().mean(dim=(1, 2))
        return frac.cpu().tolist()

    def focus_attention(self, x: int, y: int, b: int = 0):
        """Return the 9 signaling-attention weights for the cell at (x,y)."""
        onehot = _onehot_states(self.state)
        oxygen = self.oxygen.unsqueeze(1)
        w = self.attn.signaling_weights(onehot, oxygen)   # [B,9,H,W]
        return w[b, :, y, x].cpu().numpy().astype(np.float32)

    def state_numpy(self) -> np.ndarray:
        return self.state.cpu().numpy().astype(np.uint8)        # [B,H,W]

    def oxygen_numpy(self) -> np.ndarray:
        return self.oxygen.cpu().numpy().astype(np.float32)     # [B,H,W]
