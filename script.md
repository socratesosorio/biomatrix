# Living Tissue — 5-Minute Demo Video Script

**Live demo URL:** https://believe-use-listprice-lending.trycloudflare.com
**Running on:** 1× NVIDIA H100 80GB (Prime Intellect pod), engine on CUDA, 192×192 grid.

---

## How to read this script

- **SAY** = speak this, roughly verbatim (≈150 words/min → the whole thing is ~5 min with the pauses built in).
- **SHOW** = exactly what to do on screen at that moment.
- **Recording tips** are in *italics*.

> **Pre-flight (do this BEFORE you hit record):**
> 1. Open the URL, wait for the badge to read **`live · cuda`** (top-right).
> 2. Click **Map** once to run the phase sweep, let it finish (~8 s), then click back to **Tissue**. This *caches* the phase map so it appears instantly later in the video. (You'll re-trigger it live in Act 5 for the "watch it compute" beat — your call which feels better.)
> 3. Click the **Body** scene so you open on the silhouette.
> 4. Click **Bloom** preset, then **Reset**, then **Pause** — so the hero tumor is primed but frozen at t=0. Switch back to **Body** to start.

---

## ACT 1 — The Hook (0:00–0:30)

**SHOW:** Open on the **Body** scene — human silhouette, glowing tumor site pulsing at the chest.

**SAY:**
> "This is a human body with a tumor. I'm going to dive into the tissue, and everything you're about to see is a transformer running live on an H100 — not a video, not a pre-render. Every frame is being computed right now and streamed to my browser."

**SHOW:** Click **Tissue**. The camera dives from the body into the live cellular grid (single eased crossfade).

**SAY:**
> "Here's the core idea: in real tissue, cells decide what to do by sensing their neighbors. That's *attention*. So I built the simulation as a transformer — every timestep is one forward pass: neighborhood attention, then an MLP that picks each cell's next state."

---

## ACT 2 — What You're Looking At (0:30–1:20)

**SHOW:** You're in **Tissue** scene. Click **Play** if paused. Click **Bloom** preset. A tumor blooms outward from center; teal healthy tissue, magenta tumor, a dark necrotic core forming. Point to the chart bottom-left.

**SAY:**
> "Teal is healthy tissue. Magenta is tumor. As the tumor gets dense, it burns through oxygen faster than the blood can resupply it — so the center goes hypoxic and dies. That brown core is necrosis. That dead-center, active-rim shape is exactly how real tumors look, and it falls out of the physics, not a texture."

**SHOW:** Tap the order-parameter chart (bottom-left line graph).

**SAY:**
> "This line is the order parameter — the fraction of the tissue that's cancer. It's the one number that tells us which regime we're in. Watch what it does when I touch one slider."

---

## ACT 3 — The f Core (1:20–2:30) ⭐ *most important 60 seconds*

**SHOW:** Click **Homeostasis** preset. Tissue settles back to almost all teal; the order-parameter line drops toward zero.

**SAY:**
> "Right now aggression is low and the immune response is high. The immune system plus contact inhibition hold the line — the tumor can't get going. This is homeostasis. The cancer fraction sits near zero."

**SHOW:** Grab the **Aggression ★** slider and *slowly* drag it right, from ~0.20 up through ~0.40. Pause right around 0.35.

**SAY:**
> "Now I'll turn up aggression — how hard tumor cells push to proliferate and invade. Nothing… nothing… and then —"

**SHOW:** As you cross ~0.35, the tissue visibly flips to runaway magenta; the order-parameter line spikes upward.

**SAY:**
> "— there. That's a phase transition. A sharp critical threshold. Below it, the tumor goes extinct every time. Above it, it explodes every time. And I can drive it backward —"

**SHOW:** Drag **Aggression** back down below 0.30. The tumor gets suppressed again; the line falls.

**SAY:**
> "— back to healthy. This is the whole point: it's not a pretty animation, it's a f model. There's a real critical point, and you can feel it with your hand."

---

## ACT 4 — Chaos, Shown Rigorously (2:30–3:10)

**SHOW:** Click **Near-critical** preset, then click **Split seeds**. The view splits into two tissues side by side. The chart now draws two lines.

**SAY:**
> "Right at the critical point, the outcome is decided by chance. Here are two tissues with *identical* parameters — same aggression, same immune response — started from different random seeds."

**SHOW:** Let it run ~8–10 seconds so the two panels diverge (one stays mostly healthy, one runs away). Point at the two diverging chart lines.

**SAY:**
> "Same rules, same settings — and one stays healthy while the other becomes cancer. That's deterministic chaos near a tipping point, and because every cell samples its next state from the transformer's output, it's baked right into the model."

---

## ACT 5 — The Etched Kill Shot (3:10–4:00)

**SHOW:** Turn off **Split seeds**. Click **Cell** scene. The camera zooms way in; cells become big and gooey. Click on one cell — cyan attention edges fan out from it to its neighbors, with a yellow focused node and flowing dashed lines.

**SAY:**
> "Let me zoom all the way into a single cell. These glowing edges are the actual attention weights for this cell — how much it's 'listening' to each neighbor this timestep. This is the literal claim made visual: cell-to-cell signaling *is* attention. A timestep *is* a transformer forward pass."

**SHOW:** Let the attention edges pulse for a beat.

**SAY:**
> "Which means this entire simulation — all of this biology — runs natively on the one primitive a transformer ASIC accelerates. On Etched's hardware, a forward pass is nearly free. So a timestep is nearly free."

---

## ACT 6 — Compute As Free (4:00–4:40)

**SHOW:** Click **Map** (or hit **Run phase sweep**). If running live, the "thousands of forward passes in parallel" spinner shows for ~8 s, then the viridis phase diagram appears — purple bottom-left (homeostasis), bright yellow top-right (cancer), a clean diagonal critical boundary.

**SAY:**
> "And here's what 'free compute' buys you. This phase map is 2,304 *separate* simulations — every combination of aggression and immune strength — all run in parallel on the H100 as one big batched forward pass. Each pixel is a full tissue. Bright means cancer wins."

**SHOW:** Click a pixel near the boundary. The app loads that regime and animates back to the live tissue.

**SAY:**
> "I can click any point on this map and drop straight into that regime. At scale, you don't drag a slider — you search this entire space for the intervention that collapses the tumor, before you ever touch a patient."

---

## ACT 7 — The Close (4:40–5:00)

**SHOW:** Pull back to **Tissue** or **Body**; let the hero tumor breathe.

**SAY:**
> "So: cell signaling is attention, a timestep is a forward pass, and the whole thing runs on transformer silicon. The engine is on an H100 right now, streaming state to this browser over a WebSocket — the browser only paints. Near-zero-latency forward passes turn a wet-lab cycle into a parallel search. That's biology, rebuilt as inference. Thanks."

*Hard cut on the phase map or the blooming tumor.*

---

## Shot list (quick reference)

| Time | Scene/Action | The line that matters |
|---|---|---|
| 0:00 | **Body** → dive to **Tissue** | "a transformer running live on an H100" |
| 0:30 | **Bloom** preset, point at necrotic core + chart | "that shape falls out of the physics" |
| 1:20 | **Homeostasis** → drag **Aggression** up past 0.35 → back down | "that's a phase transition… f" |
| 2:30 | **Near-critical** + **Split seeds** | "same rules, one healthy, one cancer" |
| 3:10 | **Cell** scene, click a cell | "signaling *is* attention" |
| 4:00 | **Map** / **Run phase sweep**, click a pixel | "2,304 simulations in parallel… search for the cure" |
| 4:40 | back to Tissue/Body | "biology, rebuilt as inference" |

**Total ≈ 5:00.** If you run long, cut Act 4 (Split seeds) — it's the most expendable. Never cut Act 3.

---
---

# Submission Write-Up

## 1. Project title and short description

**Living Tissue — Cancer as a Transformer Forward Pass**

Living Tissue is a real-time tissue simulation in which **every timestep is a literal transformer forward pass**: cells sense their neighbors through 3×3 neighborhood attention, and an MLP samples each cell's next state. A single slider drives a **sharp, reproducible phase transition** — from healthy homeostasis to runaway cancer — across a critical threshold you can feel with your hand. A batched GPU sweep runs **thousands of these simulations in parallel** and renders the full phase diagram of "where cancer wins."

**The problem it addresses:** biology is a search problem bottlenecked by the cost of each experiment. We reframe a tissue's dynamics as *inference* on the exact primitive that transformer ASICs (e.g., Etched) accelerate. If a forward pass is effectively free, a timestep is effectively free — so an intractable wet-lab loop (try an intervention, wait, measure) becomes a massively parallel search over parameter space for the intervention that collapses the tumor. The demo is built to be **f, not decorative**: the win condition is a visible, measurable order parameter crossing a real critical point in real time.

## 2. Technical explanation

**The model (the engine is genuinely a transformer).**
- **State:** a grid (192×192 live; 48×48 in the sweep) where each cell is one of `{EMPTY, HEALTHY, TUMOR, NECROTIC}` plus a continuous oxygen field in `[0,1]`. Per-cell feature = one-hot state (4) + oxygen (1).
- **Neighborhood (windowed) attention:** each timestep gathers every cell's 3×3 neighborhood via an `unfold`/im2col token gather — NAT-style windowed attention, **O(N·9)** instead of O(N²). Two attention heads, both real softmax attention over the 9 tokens:
  - a **uniform-aggregate head** that computes the exact neighbor type-counts and the oxygen Laplacian (the aggregates the biology needs — verified bit-exact against a NumPy reference);
  - a **content-based "signaling" head** whose per-neighbor weights vary with neighbor type and oxygen — this is what's drawn as the cell-cell attention overlay.
  - Head weights are **hand-constructed**, no training required: the heads compute closed-form aggregates, which is the thesis — the local biological rule *is* an attention pattern.
- **MLP transition:** `[self embedding, neighbor aggregates] → hidden → 4 next-state logits + ΔoxygenΔ`. The next state is **sampled** from the logits.

**Inference-time techniques (the on-theme core).**
- **Sampling the forward pass:** the stochastic state transition is done by sampling from the MLP's output distribution — exactly LLM-style token sampling. "Inference-time compute = sampling the forward pass."
- **Batched parallel inference:** the phase sweep stacks `res²` independent simulations into the batch dimension (B = res²) and steps them all in a single batched forward pass — **2,304 full simulations in parallel** on one H100, producing the phase diagram in seconds. This is "near-infinite compute" made literal: parallel search, not iteration.
- **Multi-GPU sharding (built in):** the sweep auto-shards grid points across every visible CUDA device (`run_auto`), so the same code fans out across an 8×H100 box with no changes.
- **Verification harness:** because transitions are stochastic, correctness is asserted statistically — the transformer's phase-transition curve overlays the NumPy reference within tolerance (<0.02), proving the transformer faithfully implements the biology.

**Tools & infrastructure.**
- **Engine:** Python 3, **PyTorch** (CUDA), NumPy reference implementation. Device auto-selects CUDA → MPS → CPU.
- **Server:** **FastAPI + Uvicorn** — one async process steps the engine on the GPU and streams state to clients over a **WebSocket**. A compact **binary frame protocol** (little-endian: header + `uint8` state grid + quantized `uint8` oxygen + optional `float16` attention block) keeps the live stream light; JSON is used only for controls and stats.
- **Frontend:** **React + TypeScript + Vite**, **raw WebGL2** (a single full-screen quad samples an `R8UI` state texture + oxygen texture; a fragment shader does the palette, soft-disc "alive cell" shaping, oxygen underlay, and the continuous body→tissue→cell camera zoom), **zustand** for state, and a `<canvas>` for the live order-parameter chart, attention overlay, and viridis phase map. High-rate grid frames bypass React entirely and feed the GPU directly.
- **Decoupled sim/render:** the engine runs server-side on the H100; the browser only paints. This is also the honest infra story.
- **Deployment:** a single FastAPI port serves both the built frontend and the WebSocket, so one public URL runs the whole demo. It's deployed on a **Prime Intellect H100 pod** and exposed publicly via a **Cloudflare tunnel** (`cloudflared`).

**One-line architecture:** `WebGL2 browser ⇄ WebSocket ⇄ FastAPI async loop ⇄ batched PyTorch neighborhood-attention transformer on an H100`.
