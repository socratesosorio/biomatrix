# Living Tissue — a Transformer-as-Cellular-Automaton

Every timestep is a transformer forward pass. Cell–cell signaling is implemented
literally as **neighborhood (3×3 windowed) attention**; the transition rule is the
**MLP**, and the next state is **sampled** from its logits (LLM-style sampling).
Drag the **Aggression** slider across a sharp, reproducible phase transition and
watch healthy tissue flip to runaway cancer.

```
engine/   reference_ca.py  ca_transformer.py  params.py  sweep.py  test_engine.py
server/   protocol.py      server.py          (asyncio websocket sim loop)
web/      Vite + React + TS + raw WebGL2 frontend
```

## Run the demo

Two processes on localhost.

```bash
# 1. install python deps (CPU works; CUDA/MPS auto-detected)
pip install -r requirements.txt

# 2. start the engine + websocket server  (ws://localhost:8000)
python -m server.server
#    env knobs: CA_DEVICE=cpu|mps|cuda   CA_GRID=128   CA_PORT=8000

# 3. start the frontend
cd web && npm install && npm run dev      # http://localhost:5173
```

Open http://localhost:5173. Scene buttons: **Body → Tissue → Cell → Map**.

- **Tissue**: click to seed a tumor; drag **Aggression ★** across the critical
  point (~0.35) to flip homeostasis ↔ runaway. Order-parameter chart shows
  tumor fraction live.
- **Cell**: zooms in; click a cell to light up its attention edges
  (= cell-cell signaling).
- **Map**: runs a batched sweep — `res²` grids stepped in parallel on one GPU —
  rendering the phase diagram. Click any pixel to load that regime.
- **Split seeds**: two seeds, identical params, diverge near criticality.

Presets: **Homeostasis**, **Near-critical**, **Bloom (money shot)**.

## Verify the science / engine

```bash
python -m engine.reference_ca           # prints the phase-transition sweep (crisp knee)
python -m engine.test_engine            # transformer curve overlays the reference (<0.02)
python -m engine.sweep                  # batched phase map + ascii preview
```

`test_engine.py` proves two things: the uniform attention head computes the
neighbor aggregates *exactly*, and the transformer's phase-transition curve
overlays the NumPy reference within tolerance — i.e. the transformer faithfully
implements the biology.

## Wire protocol

JSON strings = control/stats; binary frames = grid state (little-endian):
`magic(u16) tick(u32) W(u16) H(u16) B(u8) flags(u8)` then `state[B*H*W]` (u8),
`oxygen[B*H*W]` (u8), and optionally `focusX,focusY` + 9 attention weights (f16).
