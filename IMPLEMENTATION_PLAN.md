Living Tissue: A Transformer-as-Cellular-Automaton — Implementation Plan

One line: A real-time tissue simulation where every timestep is a transformer forward pass (neighborhood attention + MLP). The user zooms from a human body → into living tissue → into a single cell's attention pattern. A slider drives a real, f phase transition from healthy homeostasis to runaway cancer. A batched GPU sweep renders the full phase diagram as "thousands of forward passes in parallel."

Why it's built this way (read before coding):


The engine MUST be a transformer (attention + MLP), not a generic GPU kernel. The pitch to Etched only works if the simulation runs on the one primitive their ASIC accelerates. Cell-cell signaling = attention; a timestep = a forward pass. Implement it literally as neighborhood attention.
The demo must be f. The win condition is a judge dragging a slider and watching a sharp, reproducible phase transition with a visible order parameter. Pretty animation alone loses. Protect the f core above all polish.
Decouple sim from render: engine runs server-side on the provided H100, streams state over WebSocket; the browser only paints. This is also the honest infra story.



0. Stack & Repo Layout

Engine/server (Python 3.11): PyTorch (CUDA, runs on the hackathon-provided 8×H100 box), NumPy (reference), websockets or FastAPI+uvicorn for the WS server, asyncio sim loop.

Frontend: Vite + React + TypeScript, raw WebGL2 (no heavy 3D lib — the tissue is a single full-screen quad sampling a data texture; this is the lightest, fastest path). zustand for state. Custom <canvas> for the live chart and phase-map heatmap.

Run model for the demo: everything on localhost on the H100 box. python -m server.server + npm run dev, client WS → ws://localhost:8000. Record the screen. Modal ($20k credits) is the fallback and for oversized sweeps; the primary sweep runs batched on the local H100.

/engine
  reference_ca.py    # numpy reference rules + a script that proves the phase transition exists
  ca_transformer.py  # torch neighborhood-attention CA engine (BATCHED over seeds)
  params.py          # CAParams dataclass + presets: MONEY_SHOT, NEAR_CRITICAL, SWEEP
  sweep.py           # batched parameter sweep on one GPU -> phase-map array
/server
  protocol.py        # binary frame encode/decode + JSON message schemas
  server.py          # asyncio websocket server: sim loop + control handling
/web
  index.html
  src/main.tsx
  src/state.ts          # zustand store (params, scale, playing, stats buffer)
  src/net/ws.ts         # ws client: decode binary frames, route JSON stats
  src/gl/renderer.ts    # WebGL2: textures, camera uniforms, draw loop
  src/gl/shaders.ts     # vertex + fragment (cell-disc + oxygen underlay + palette)
  src/ui/Stage.tsx      # canvas host + body layer + attention overlay + zoom timeline
  src/ui/Controls.tsx   # sliders (aggression, immune, mutation, speed), play/reset/spawn, presets
  src/ui/OrderParam.tsx # live order-parameter line chart (ring buffer)
  src/ui/PhaseMap.tsx   # heatmap render + click-a-pixel-to-load


1. The Engine — Tissue as a Neighborhood-Attention Transformer

1.1 State model

Grid H×W (default 128×128 = 16,384 cells; drop to 96² if anything is tight). Batch dim B for running multiple seeds at once (B=1 normal, B=2 for the split/chaos view, B=res² for the sweep).

Per cell:


state ∈ {EMPTY=0, HEALTHY=1, TUMOR=2, NECROTIC=3} — stored as uint8 [B,H,W].
O oxygen ∈ [0,1] — float32 [B,H,W], stored separately.


1.2 Reference rules (reference_ca.py) — build & verify these FIRST

Write the plain NumPy version first and run a script that confirms the phase transition is real. This de-risks the science before any GPU/UI work. Synchronous update (next grid computed from current).

Oxygen update (diffusion + consumption + uniform source):

O_next = clip( O + O_DIFF * laplacian8(O) - consume(state) + O_SOURCE , 0, 1 )
# consume: HEALTHY->C_H, TUMOR->C_T  (C_T > C_H), EMPTY/NECROTIC->0

Dense tumor outpaces O_SOURCE → hypoxic core → necrosis. This is what produces the dead-center / active-rim morphology that reads as a real tumor.

State transition (stochastic). For each cell compute 8-neighbor counts n_empty, n_healthy, n_tumor; crowding = n_healthy + n_tumor:

EMPTY:
  if n_tumor>0 and rand < AGGRESSION * (n_tumor/8):        -> TUMOR     # proliferation into space
  elif n_healthy>0 and crowding<INHIB and rand < P_REGROW: -> HEALTHY   # contact-inhibited regrowth
  else: EMPTY
HEALTHY:
  if O < O_NECRO:                                          -> NECROTIC
  elif rand < P_MUT:                                       -> TUMOR     # mutation (a knob)
  elif n_tumor>0 and rand < P_INVADE*(n_tumor/8):          -> TUMOR     # tumor invades tissue (aggression)
  else: HEALTHY
TUMOR:
  if O < O_NECRO:                                          -> NECROTIC  # hypoxic core forms here
  elif rand < IMMUNE:                                      -> EMPTY     # immune clearance (the suppression knob)
  else: TUMOR
NECROTIC:                                                  -> NECROTIC  # persistent (keep the visible core)

Order parameter: tumor_fraction = (#TUMOR + #NECROTIC) / (H*W).

The phase transition (the whole demo): Fix IMMUNE, sweep AGGRESSION (≡ proliferation/invasion strength). Below a critical value, immune clearance + contact inhibition hold tumor_fraction ≈ 0 (homeostasis). Above it, proliferation outruns clearance → runaway growth → tumor_fraction jumps to large. The transition is sharp (a contact-process / branching-type threshold) and seed-sensitive near criticality (small fluctuations decide extinction vs explosion — that's your "chaos" beat, shown rigorously).

Verification script (must pass before moving on): sweep AGGRESSION over ~20 values, 3 seeds each, T≈250 steps, plot final tumor_fraction vs AGGRESSION. You must see a clean sigmoid/knee. Tune defaults until the knee is crisp and sits at a convenient slider position. Save the working numbers into params.py presets.

1.3 The transformer engine (ca_transformer.py) — the Etched claim, made literal

Implement the exact same dynamics as a neighborhood-attention block (NAT-style windowed attention) + MLP. This is genuinely a transformer forward pass per timestep.

Per cell feature: x = [onehot(state)(4), O(1)] -> d_in=5, linearly embedded to d=32.

Windowed attention over the 3×3 neighborhood (9 tokens):


Gather each cell's 3×3 neighbor embeddings (im2col / F.unfold → [B, H*W, 9, d]). This makes attention O(N·9), not O(N²) — trivial on an H100, hundreds+ steps/sec at 128².
Q = self embedding; K,V = the 9 neighbors. attn = softmax(Q·Kᵀ/√d) over the 9; output = attn·V.
A uniform-attention head over one-hot-type values yields neighbor type fractions (×8 = the counts n_*); a head with a signed/Laplacian value projection yields the oxygen Laplacian and mean(O_neighbor) − O_self. So attention computes exactly the aggregates the rules need. (You can set these heads' weights directly; they don't need training.)
Residual + the aggregated neighbor features feed the MLP.


MLP = the transition function: input [self_embed, neighbor_aggregates] -> hidden(64) -> [4 next-state logits, ΔO]. Two valid ways to get the weights:


Hand-construct weights that implement the thresholds above (fast, fully controllable, no training). The stochastic transitions come from sampling the next state from the MLP's logits — which is exactly LLM-style token sampling, and a clean on-theme line ("inference-time compute = sampling the forward pass"). Default to this.
(Optional, only if time): distill — train the MLP to match the reference CA's transition distribution. Nice flex ("we distilled the rules into a transformer") but not required.


Correctness test (required): run reference and transformer from the same seed/initial grid for T steps. Because transitions are stochastic, don't assert exact grid equality — assert the tumor_fraction trajectory matches within tolerance and the phase-transition curve matches (run the §1.2 sweep through both). If the curves overlay, the transformer faithfully implements the biology. Put this in a test you can show.

Batched: all ops carry a batch dim. B=2 → two seeds side by side (chaos view). B=res² → the sweep. Per-cell stochasticity uses a per-(b,h,w) RNG so seeds genuinely differ.

Focus output (for the attention overlay): given a focused (x,y), return that cell's 9 attention weights (float16) so the frontend can draw signal edges.

params.py presets to ship:


MONEY_SHOT: AGGRESSION just above critical, moderate IMMUNE, O tuned so a seeded tumor blooms with a necrotic core over ~30s. This is the recorded hero run.
NEAR_CRITICAL: AGGRESSION ≈ critical — used for the two-seed divergence.
SWEEP: the (AGGRESSION × IMMUNE) ranges + resolution for the phase map.



2. Server (server/) — asyncio sim loop + WS protocol

Single Python process on the H100. One asyncio task steps the engine; the WS handler pushes frames and ingests control messages. Engine ticks at a capped rate (default 30/s, adjustable live); push every tick (or every Kth if the client lags).

2.1 Protocol (protocol.py)

Disambiguate by type: JSON strings = control/stats; binary ArrayBuffers = state frames.

Client → Server (JSON):

{type:"set_params", params:{aggression, immune, mutation, o_source, ...}}  // throttle to ~10/s
{type:"reset", seed:int, params:{...}}
{type:"play"} | {type:"pause"} | {type:"set_speed", ticks_per_sec:int}
{type:"spawn", x:int, y:int, radius:int}        // inject a tumor seed
{type:"focus", x:int, y:int}                     // request attention weights for overlay
{type:"split", on:bool}                          // B=2 two-seed mode
{type:"sweep", axisA, rangeA:[lo,hi], axisB, rangeB:[lo,hi], res:int, steps:int}

Server → Client (binary state frame): little-endian

header: magic(u16) | tick(u32) | W(u16) | H(u16) | B(u8) | flags(u8)
payload: state[B*H*W] (u8)  then  oxygen_q[B*H*W] (u8, O quantized 0..255)
optional (flags&FOCUS): focusX(u16) focusY(u16) attn[9] (f16)

~16KB/frame for state at 128² (×2 with oxygen) — fine at 30fps on localhost. Always binary, never JSON, for grid data.

Server → Client (JSON stats), ~10/s:

{type:"stats", tick, tumor_fraction:[per-batch float], necrotic_fraction:[...]}
{type:"sweep_result", axisA, axisB, res, grid:[res*res floats]}  // final tumor_fraction per cell

2.2 server.py


Hold engine state + current CAParams. On set_params/reset/spawn/split, mutate engine in place (reset rebuilds the grid with the given seed; spawn stamps a disc of TUMOR).
Sim loop: if playing, engine.step(), encode frame, send to all clients; every ~3rd tick send a stats message.
sweep: call sweep.run(...) (batched, blocks ~1–2s), send sweep_result. Run in a thread/executor so the loop doesn't stall.
focus: set the focused cell so subsequent frames include the attn block.



3. The Parameter Sweep (sweep.py) — the "near-infinite compute" asset

The elegant move: one batched GPU run. Build B = res×res grids (default res=24 → 576 grids, each 48² or 64²), each with a different (AGGRESSION, IMMUNE) from the 2D grid, step them all in parallel for T≈200 steps, collect final tumor_fraction per grid → res×res array. That is "thousands of forward passes in parallel," literally true, and it produces the phase diagram in 1–2s on one H100. (Modal fan-out is the alt for huge sweeps / sponsor cred — mention it, but batched-on-one-GPU is simpler and just as impressive.)

Output → sweep_result. Frontend renders it as a heatmap with a visible critical boundary. Clicking a pixel loads that (AGGRESSION, IMMUNE) into the live sim. Tagline: "each pixel is a full simulation; this is the map of where cancer wins."


4. Frontend (web/)

4.1 Rendering (gl/renderer.ts, gl/shaders.ts)

One WebGL2 canvas. Tissue = full-screen quad; a fragment shader samples a state texture (R8UI, W×H, or W×2H when B=2) and an oxygen texture, and colors each fragment. Upload the latest frame's grids straight into textures each animation frame.

Camera = uniforms uCenter(vec2), uScale(float) that window the UVs. Zoom = shrink the UV window → cells grow. This gives the whole body→tissue→cell zoom with one mechanism (no real 3D needed).

Fragment shader does the "cells look alive" work:


Map state → palette: EMPTY → near-transparent dark; HEALTHY → soft teal/pink; TUMOR → hot magenta/red; NECROTIC → brown/black.
Oxygen as a subtle underlay (low O → darker/bruised).
Cell shaping: from the sampled-cell-local UV (fract), draw a soft disc via smoothstep on distance to cell center, darken inter-cell gaps (membrane look), add a per-cell hash jitter so it's organic, not a grid of squares.
At high zoom, discs get large and gooey → reads as real cells.


Palette + shaping is where ~80% of the "wow" comes from for ~20% of the effort. Do not skip it, but do it in M3 after the f core works.

4.2 The three-scale zoom (ui/Stage.tsx)

Only one crossfade; the rest is continuous camera zoom on the same texture.


Scale 1 — Body: a separate layer (SVG/PNG body silhouette + a glow at the tumor site; glow can be a shader or a blurred radial). Pure hook. Do NOT model anatomy — the zoom motion sells it.
Body → Tissue dive: animate a timeline t∈[0,1] (~1.5s, ease-in-out): body opacity 1→0 and scale 1→~6, while the tissue layer opacity 0→1 and uScale eases from zoomed-out to default. Single crossfade.
Scale 2 — Tissue: the live quad. Slider + order-parameter chart live here. This is the f core.
Tissue → Cell: keep increasing uScale (continuous, no crossfade — same data). Past a zoom threshold, fade in the attention overlay.
Scale 3 — Cell + attention: overlay (SVG or 2nd canvas) drawing lines from the focused cell to its 8 neighbors, stroke-opacity = attention weight (from the frame's focus block), animated dash offset = signal flowing. This is the visual that proves "biology is a transformer." Highest-payoff novelty visual; also first to cut if behind (can be carried verbally + a static slide).
Scale presets: Body / Tissue / Cell / Map buttons animate the camera to each.


4.3 Controls (ui/Controls.tsx)

Sliders bound to set_params (throttled ~10/s). Foreground the two phase-transition knobs: AGGRESSION and IMMUNE (plus MUTATION, O_SOURCE, SPEED). Buttons: Play/Pause, Reset (new random seed), Spawn tumor (stamps at center). Split seeds toggle (B=2). The hero interaction: judge drags AGGRESSION across the critical point → tissue flips homeostasis↔runaway in real time while the order-parameter line spikes.

4.4 Order-parameter chart (ui/OrderParam.tsx)

Small <canvas>, ring buffer of tumor_fraction from stats messages, draw the live line + a shaded "critical region." In split mode, two lines (the two seeds diverging near criticality = the chaos beat, visualized).

4.5 Phase map (ui/PhaseMap.tsx)

On sweep_result, render the res×res heatmap (canvas or a tiny WebGL quad, viridis colormap) with axis labels (AGGRESSION × IMMUNE) and the visible critical boundary. Click a pixel → set_params+reset with that point, then animate camera back to Tissue to watch that exact regime. Reachable as the "zoom all the way out" final view — a clean cinematic bookend.

4.6 Net (net/ws.ts)

Open WS; if event.data is a string → JSON (route stats/sweep to the store); if ArrayBuffer → decode the frame header + grids, hand textures to the renderer, stash any focus attn for the overlay. Expose typed senders for every control message.


5. Build Order — 2.5h, parallelizable across coding agents

Each milestone leaves you with a strictly better, still-working demo. Never sacrifice an earlier milestone for a later one.


M0 (0:00–0:15) — De-risk the science. Scaffold repo. Write reference_ca.py + the verification script; confirm a crisp phase transition and lock the winning numbers into params.py. Do this before any GPU/UI work — if the science isn't f, nothing else matters.
M1 (0:15–1:00) — Live tissue (the long pole). ca_transformer.py on the H100 + server.py streaming binary frames + a minimal client that uploads the state texture and renders it (ugly is fine). Goal: a tumor blooms on screen, live, fed by the transformer engine. Kick this off in parallel with M0's tail.
M2 (1:00–1:30) — f + interactive. AGGRESSION/IMMUNE sliders, Reset+seed, Spawn, and the live order-parameter chart. A winning demo exists at this checkpoint — protect it. If you stop here you still have the core that beats most of the room.
M3 (1:30–2:00) — Cinematic. Shader polish (disc cells, oxygen underlay, palette) + Body→Tissue zoom crossfade + two-seed split view.
M4 (2:00–2:20) — The differentiator. Land one of: attention overlay at cell scale, or the batched sweep + phase map. Pick whichever is more on-track. Both is a bonus, not a goal.
M5 (2:20–2:30) — Ship. Load MONEY_SHOT, record the best run (body dive → slider crosses critical → tumor blooms with necrotic core → two seeds diverge → zoom out to phase map). Write the Devpost. Hard stop coding at 2:20.


Cut order if behind: drop attention overlay (carry verbally) → drop phase map → drop two-seed split → keep M2 core no matter what.


6. Risks & Mitigations


WS throughput: binary frames only + throttle controls; cap grid at 128² (shader render is cheap, so resolution isn't the render bottleneck — network is).
Reference↔transformer determinism: stochastic, so test statistics (tumor_fraction trajectory + phase curve within tolerance), not exact grids.
Zoom jank: precompute the body layer; single crossfade + continuous camera zoom; drive with one eased t.
Modal cold start during demo: run the engine locally on the provided H100; Modal only for oversized sweeps. The recorded demo is all localhost.
Sweep cost: batch on one GPU (res²≈576 small grids, T≈200) → 1–2s. No fan-out needed for demo scale.
Time slipping in M1: if the transformer engine fights you, temporarily drive the UI from the NumPy reference to keep the pipeline live, and swap the transformer in behind the same protocol. The protocol is the contract; either engine satisfies it.



7. Recording / Demo Checklist (the hero run)


Open on the body, tumor site glowing. (hook)
Dive into tissue. (the gasp)
Drag AGGRESSION up across the critical point → tissue flips to runaway growth; necrotic core forms; order-parameter line spikes. Drag it back down → suppressed. (f, interactive — the most important 30s)
Toggle Split seeds at NEAR_CRITICAL → two tissues, same params, diverge (one tumor, one healthy). (chaos, shown rigorously)
Zoom into a single cell → attention edges light up as signals pass. Say the line: "cell-cell signaling is attention; a timestep is a forward pass; this runs natively on a transformer ASIC." (the Etched kill shot)
Zoom out to the phase map → "each pixel is a full simulation, thousands of forward passes in parallel; this is the map of where cancer wins. At scale you search it for the intervention that collapses the tumor before touching a patient." (impact/trajectory)


Land on the thesis: near-zero-latency forward passes on dedicated transformer silicon turn a wet-lab cycle into a parallel search. Tie explicitly to Etched's "build as if compute is free" prompt.