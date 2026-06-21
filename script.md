# Living Tissue — 5-Minute Demo Video Script

**Live demo URL:** https://believe-use-listprice-lending.trycloudflare.com
**Running on:** 1× NVIDIA H100 80GB (Prime Intellect pod), engine on CUDA, 192×192 grid.

---

## How to read this script

- **SAY** = speak this, roughly verbatim (≈150 words/min → the spoken parts total ~5 min with the pauses built in).
- **SHOW** = exactly what to do on screen at that moment.
- **CLAIM** tags map each beat to the persuasive argument it's landing.
- *Recording tips are in italics.*

> **Pre-flight (do this BEFORE you hit record):**
> 1. Open the URL, wait for the badge to read **`live · cuda`** (top-right).
> 2. Click **Map** once to run the phase sweep, let it finish (~8 s), then click back to **Tissue** — this *caches* the phase map so it's instant later. (You'll re-trigger it live in Act 6 for the "watch it compute" beat.)
> 3. Click **Bloom** preset → **Reset** → **Pause**, so the hero tumor is primed but frozen at t=0.
> 4. Click the **Body** scene so you open on the silhouette.
>
> *Two new controls exist now: the **Infectivity** + **Latent period** sliders and the **Release virus** button. The chart draws two lines — pink = tumor, orange = infected.*

---

## ACT 1 — The Hook (0:00–0:35) · CLAIM #1 (the keystone)

**SHOW:** Open on **Body** — human silhouette, glowing tumor site pulsing at the chest.

**SAY:**
> "This is a human body with a tumor. I'm going to dive into the living tissue — and everything you're about to see is a transformer, running live on an H100 right now. Not a video. Not a pre-render."

**SHOW:** Click **Tissue**. Camera dives from the body into the live cellular grid.

**SAY:**
> "Here's the one idea this whole thing rests on. In real tissue, a cell decides what to do by weighing signals from its neighbors. That *is* attention — the exact same operation: a set of entities, each updating by weighted aggregation over its neighbors. Biology has been running attention for a billion years; we just recognized the shape and wrote the dynamics in it. So every timestep here is a transformer forward pass — which means this runs *native* on a transformer ASIC."

---

## ACT 2 — What You're Looking At (0:35–1:15)

**SHOW:** In **Tissue**, click **Play**, then **Bloom** preset. A tumor blooms; teal healthy tissue, magenta tumor, a dark necrotic core forming. Point to the chart bottom-left.

**SAY:**
> "Teal is healthy tissue, magenta is tumor. As the tumor packs in, it burns oxygen faster than the blood resupplies it, so the core goes hypoxic and dies — that brown center is necrosis. That dead-core, living-rim shape is how real tumors look, and it falls out of the physics, not a texture. And this line is the order parameter: the fraction of tissue that's cancer. One number that tells us which world we're in."

---

## ACT 3 — The Falsifiable Core (1:15–2:10) ⭐ *most important 60 seconds*

**SHOW:** Click **Homeostasis** preset. Tissue settles to almost all teal; the order-parameter line drops toward zero.

**SAY:**
> "Right now aggression is low, immunity is high. The immune system plus contact inhibition hold the line — cancer can't get going. This is homeostasis."

**SHOW:** Grab **Aggression ★** and *slowly* drag right from ~0.20 toward ~0.40. Pause around 0.35.

**SAY:**
> "Now I turn up aggression — how hard tumor cells push to proliferate and invade. Nothing… nothing… and then —"

**SHOW:** Crossing ~0.35, the tissue flips to runaway magenta; the order-parameter line spikes.

**SAY:**
> "— there. A phase transition. A sharp critical threshold: below it the tumor goes extinct every time, above it it explodes every time. And I can drive it back —"

**SHOW:** Drag **Aggression** back below 0.30; the tumor is suppressed, the line falls.

**SAY:**
> "This isn't a pretty animation. It's a falsifiable model — a real critical point you can feel with your hand."

---

## ACT 4 — The Virus, and Why Emergence Is the Product (2:10–3:10) · CLAIMS #3 + #4

**SHOW:** Click **Homeostasis** (calm canvas), then click **Release virus**. A bright-orange infection front blooms from center; behind it a grey dead core; the **orange line** on the chart climbs. *Optionally nudge the **Infectivity** slider up.*

**SAY:**
> "Now watch me drop a completely different agent into the *same* tissue — a virus. Healthy cells get exposed, turn infectious, shed virus to their neighbors, and die. Orange is infectious, grey is killed."

**SHOW:** Point at the pale-yellow ring just ahead of the orange front.

**SAY:**
> "And here's the point of the whole project. We didn't *discover* cancer, and we didn't discover viruses — the local rules are simple and known. The product is what they do that you cannot reason out by hand. Look: the virus's most dangerous property — this silent spread — comes from the latent period. Those cells are already infected but still look healthy. We never coded 'silent spread.' It's emergent. The bottleneck in biology was never knowing the local rules. It's the compute to explore what they imply."

**SHOW:** Gesture between the tumor and the virus.

**SAY:** *(CLAIM #4 — the platform line)*
> "And cancer and this virus run on the *same* engine — zero changes. Encode the substrate once, and the agents are swappable: a drug, a gene knockout, a second pathogen — the consequences come for free."

**SHOW:** *(optional, ~15 s if you have the time)* Leave both agents running so the magenta tumor, the brown hypoxic necrosis, and the grey viral death overlap in the same region. Point at the muddied middle.

**SAY:** *(the confounding insight — CLAIM #3, sharpened)*
> "And watch what happens when they overlap. Now I've got two ways for a cell to die — the tumor starving it of oxygen, and the virus killing it — in the same patch of tissue. Just looking, you *cannot* tell which agent did what; the signatures mask each other. Stack a second pathogen on top and it's hopeless by eye. The only way to attribute cause is to run the counterfactuals — tumor alone, virus alone, both — and diff them. That's not a visualization problem you can squint your way out of; it's a *compute* problem. Disentangling interacting diseases is exactly the thing you can only do by running it, in parallel, many times."

---

## ACT 5 — The Etched Kill Shot (3:10–3:50) · CLAIM #1 proven

**SHOW:** Click **Cell** scene. Camera zooms into individual cells (big, gooey). Click one cell — cyan attention edges fan to its neighbors, yellow focused node, flowing dashes.

**SAY:**
> "Let me prove claim one isn't a metaphor. These glowing edges are the actual attention weights for this single cell — how much it's weighing each neighbor, this timestep. That's not 'like' attention. It *is* attention, computing 'what is my neighborhood.' Which is exactly why this entire simulation runs on the one primitive a transformer chip accelerates. On Etched's hardware a forward pass is nearly free — so a timestep is nearly free."

---

## ACT 6 — Compute as Instrument, and Why You Need the Ensemble (3:50–4:35) · CLAIMS #2 + #6

**SHOW:** Click **Map** (or **Run phase sweep**). The viridis phase diagram appears — purple homeostasis, bright-yellow cancer, a clean diagonal critical boundary.

**SAY:** *(CLAIM #2 — make the Etched founders feel seen)*
> "And this is the part for the hardware people. A simulation has no gradients — it's pure inference, forever. So a chip built for inference throughput isn't a model server; it's a scientific instrument. This map is over two thousand separate tissues, every combination of aggression and immunity, run in parallel as *one* batched forward pass on the H100. That's what inference-time compute actually means — running the world forward, millions of times."

**SHOW:** Switch on **Split seeds** (two tissues, identical params, near-critical). Let them diverge — one healthy, one cancer. Point at the two chart lines.

**SAY:** *(CLAIM #6 — the rigorous reason for parallel compute)*
> "And here's why you *need* that parallelism. Near the critical line, a single run lies. Same parameters, two seeds — one goes extinct, one explodes, and a tiny fluctuation decided it. So where it matters most, you can't trust one simulation. You need the ensemble — thousands of parallel runs to get the distribution. That's the scientific argument for near-infinite parallel compute."

---

## ACT 7 — The Trajectory & The Close (4:35–5:00) · CLAIM #5 + thesis

**SHOW:** Click a pixel on the **Map** (if still up) or pull back to **Tissue**; let the hero tumor breathe.

**SAY:** *(CLAIM #5 — the foundation-model trajectory)*
> "Today I hand-set these rules — which makes them interpretable; I can point at the oxygen head, the crowding head. Newton handed Mujoco its physics. Biology won't hand us its interaction weights — so you learn them, from perturb-seq, CRISPR screens, microscopy. A transformer runs fast on the chip *and* is trainable from that data. A CUDA kernel does neither. More compute, simulate more, generate more data, learn a better engine — a foundation model of cell dynamics."

**SAY:** *(the one line that lands it all — slow down here)*
> "Cell signaling is attention, so simulating biology is running forward passes — which turns a transformer chip into an instrument for running the world forward, in parallel, to discover the things we can't predict by hand. Thanks."

*Hard cut on the phase map or the blooming tissue.*

---

## Shot list (quick reference)

| Time | Scene / Action | The line that matters | Claim |
|---|---|---|---|
| 0:00 | **Body** → dive to **Tissue** | "biology has run attention for a billion years" | #1 |
| 0:35 | **Bloom**, point at necrotic core + chart | "falls out of the physics, not a texture" | — |
| 1:15 | **Homeostasis** → drag **Aggression** past 0.35 → back | "a falsifiable model you can feel" | — |
| 2:10 | **Homeostasis** → **Release virus** | "silent spread is emergent — we never coded it" | #3 |
| 2:55 | gesture tumor ↔ virus | "same engine, swap the agent" | #4 |
| 3:05 | *(optional)* let tumor + virus overlap | "two causes of death, you can't tell which — only compute disentangles it" | #3 |
| 3:10 | **Cell**, click a cell | "it *is* attention — not a metaphor" | #1 |
| 3:50 | **Map** / **Run phase sweep** | "pure inference → the chip is an instrument" | #2 |
| 4:10 | **Split seeds** near-critical | "near criticality a single run lies — need the ensemble" | #6 |
| 4:35 | back to Tissue | "hand-set today, learnable tomorrow" | #5 |

**Total ≈ 5:00.** If you run long, the most compressible beat is Act 6's Split-seeds half — keep the sweep + Claim #2, trim the ensemble line to one sentence. **Never cut Act 3 or Act 4.**

> **Claim discipline:** you don't have to say all six. The spine is **#1 → #3 → #2 → #6 → #5**, with #4 riding along on the virus reveal. Under probing, the one-line defenses:
> - **#1:** the neighbor-aggregation head is literally attention computing "what's my neighborhood."
> - **#3:** silent spread (latent period) is emergent — never coded; you can only get it by running it.
> - **#4:** cancer and virus share the engine with zero changes — encode substrate once, agents swap.
> - **#2:** no gradients anywhere — it's inference forever, so the chip is an instrument, not a server.
> - **#6:** two seeds, identical params, diverge at criticality → you need the distribution, not one run.
> - **#5:** hand-set = interpretable now; learnable from perturbation data later; transformer does both, a CUDA kernel does neither.

---

## Anticipated questions & answers (for live Q&A)

Each answer routes to the claim that wins it. Keep them to 2–3 sentences out loud.

**Q: "Don't we already understand cancer? You hard-coded rules you already knew."** → *CLAIM #3*
> "The rules are known and simple — that's the point, not the weakness. The product isn't the rules; it's the *emergence*, and emergence is unknowable by reasoning. Nobody can intuit what virus × tumor does in shared tissue, or that a latent period produces silent spread — we never coded 'silent spread,' it fell out. The bottleneck in biology was never knowing the local rules; it's the compute to explore what they imply."

**Q: "When you add multiple diseases, how do you even know what's happening? Doesn't it just become noise?"** → *CLAIM #3 + #6*
> "Exactly — that's the hard part, and it's why this needs compute. When the tumor and the virus overlap, two different causes of death sit in the same tissue and their signatures mask each other; by eye you genuinely cannot attribute which agent did what, and a third pathogen makes it hopeless. The only way to disentangle interacting diseases is to run the counterfactuals — each agent alone, then together — and diff them, many times over. Confounding isn't a visualization problem; it's a parallel-compute problem."

**Q: "Isn't this just a cellular automaton with a transformer logo slapped on?"** → *CLAIM #1*
> "No — the neighbor-aggregation step *is* softmax attention; I can show you the head computing 'what is my neighborhood' as weighted aggregation over the 3×3 window. A CA and a transformer layer are the same operation here: entities updating by weighted aggregation over neighbors. That's not branding; it's why a timestep is a forward pass and why it runs native on a transformer ASIC."

**Q: "Why a transformer chip instead of a CUDA kernel? A kernel would be faster."** → *CLAIM #5 (+ #2)*
> "A CUDA kernel is fast but frozen and unlearnable. Today our weights are hand-set — interpretable, you can point at the oxygen head and the crowding head — but biology won't hand us its true interaction weights the way Newton handed Mujoco its physics. So the frontier is *learning* them from perturbation data: perturb-seq, CRISPR screens, microscopy. A transformer runs fast on the ASIC *and* is trainable from that data. A kernel does neither — it can't become a foundation model of cell dynamics."

**Q: "Why do you need 'near-infinite' parallel compute? Isn't one good simulation enough?"** → *CLAIM #6 (+ #2)*
> "Near the critical line a single run lies. Two seeds, identical parameters — one tumor goes extinct, one explodes; a tiny fluctuation decides. So exactly where the science is interesting, the system is chaotic and you can't trust one trajectory — you need the *distribution*, thousands of parallel runs. That's the rigorous reason for parallel compute: not bigger, but the ensemble."

**Q: "Why is this the right thing to build on Etched's hardware specifically?"** → *CLAIM #2 (+ #1)*
> "Everyone assumes compute means training bigger models. But a simulation has no gradients — it's pure inference, forever. So a chip built for inference throughput isn't a model server; it's a scientific instrument for running the world forward, in parallel, millions of times. That's the literal meaning of inference-time compute — and because cell signaling is attention, our 'world' is exactly the workload their silicon accelerates."

**Q: "Is this real biology, or a toy?"** → *CLAIM #5 (own the seam)*
> "Honestly, today it's a hand-tuned model — and that's a feature: it's interpretable and falsifiable, with a real, reproducible phase transition. The trajectory is to learn the interaction weights from real perturbation data, which closes a flywheel: more compute → simulate more → generate more data → a better engine. The demo is the substrate; the foundation model of cell dynamics is the destination."

**Q: "What did adding the virus actually prove?"** → *CLAIM #4 + #3*
> "Two things. First, composability: cancer and the virus run on the same engine with zero changes — encode the substrate once and agents are swappable, like Mujoco made physics reusable for robotics. Second, it makes emergence undeniable — the silent latent spread, and the confounding when both diseases overlap, are things we never wrote and can't predict; they only exist when you run it."

---
---

# Submission Write-Up

## 1. Project title and short description

**Living Tissue — Cancer (and Viruses) as Transformer Forward Passes**

Living Tissue is a real-time tissue simulator in which **every timestep is a literal transformer forward pass**: each cell updates by weighted aggregation over its 3×3 neighborhood — i.e. neighborhood attention — and an MLP samples its next state. A single slider drives a **sharp, reproducible phase transition** from healthy homeostasis to runaway cancer across a critical threshold you can feel by hand. A second agent — a **virus** (susceptible → exposed → infectious → dead, with a diffusing viral-load field) — drops into the *same* engine with zero changes to the cancer rules, and a batched GPU sweep runs **thousands of full simulations in parallel** to render the phase diagram of "where cancer wins."

**The problem it solves:** biology's bottleneck is not knowing the local rules — those are often simple and known — it's the **compute to explore what they imply**. Known local rules produce unknowable global behavior (the virus's silent spread is emergent, never coded). And when multiple agents share the tissue — tumor plus virus, or two pathogens — their effects **confound**: distinct causes of death overlap and mask each other, so you cannot attribute cause by inspection. Disentangling them requires running the counterfactuals (each agent alone, then together) and diffing — confounding is not a visualization problem, it is a parallel-compute problem. We reframe a tissue's dynamics as *inference* on the exact primitive transformer ASICs accelerate. If a forward pass is effectively free, a timestep is free, an ensemble of timesteps is free — and an intractable wet-lab loop becomes a massively parallel search for the intervention that collapses the tumor, before you touch a patient. The substrate is encoded once and the agents are swappable, so this is a **platform** (cancer, virus, and next a drug or knockout), not a single demo. The thesis line: *cell signaling is attention, so simulating biology is running forward passes — which turns a transformer chip into an instrument for running the world forward, in parallel, to discover what we can't predict by hand.*

## 2. Technical explanation

**The model (the engine is genuinely a transformer).**
- **State:** a grid (192×192 live; 48×48 in the sweep) where each cell is one of `{EMPTY, HEALTHY, TUMOR, NECROTIC, EXPOSED, INFECTIOUS, VIRAL_DEAD}`, plus two continuous fields — oxygen and viral-load — in shared tissue. Per-cell feature = one-hot state + oxygen.
- **Neighborhood (windowed) attention:** each timestep gathers every cell's 3×3 neighborhood via an `unfold`/im2col token gather — NAT-style windowed attention, **O(N·9)** not O(N²). Two real softmax-attention heads: a **uniform-aggregate head** that computes the exact neighbor type-counts and the oxygen/viral Laplacians (verified bit-exact against a NumPy reference), and a **content-based "signaling" head** whose per-neighbor weights vary with neighbor type/oxygen — drawn as the cell-cell attention overlay. Head weights are **hand-set** (no training): the heads compute closed-form aggregates, which is the thesis — the local biological rule *is* an attention pattern.
- **MLP transition:** `[self embedding, neighbor aggregates] → hidden → next-state logits + Δoxygen`. The next state is **sampled** from the logits.
- **Composability:** the virus agent reuses the exact same neighbor-aggregation (infectious-neighbor count) and the same Laplacian machinery (viral-load diffusion clones the oxygen field's), and is **purely additive** — the cancer transition rules are untouched and remain bit-identical.

**Inference-time techniques (the on-theme core).**
- **Sampling the forward pass:** stochastic state transitions sample from the MLP's output distribution — exactly LLM-style token sampling. "Inference-time compute = sampling the forward pass."
- **Batched parallel inference:** the phase sweep stacks `res²` independent simulations into the batch dimension and steps them all as one batched forward pass — **~2,300 full tissues in parallel** on one H100 → the phase diagram in seconds. Simulation has no gradients; it is **inference forever**, which reframes the inference chip as a scientific instrument.
- **Ensembles for chaotic regimes:** near the critical threshold a single run is unreliable (two seeds with identical parameters diverge to extinction vs. explosion), so the *distribution* — thousands of parallel runs — is the scientifically correct object. This is the rigorous reason for near-infinite parallel compute.
- **Multi-GPU sharding (built in):** `run_auto` shards sweep points across every visible CUDA device, so the same code fans out across an 8×H100 box unchanged.
- **Statistical verification:** because transitions are stochastic, correctness is asserted on statistics — the transformer's phase-transition curve overlays the NumPy reference within tolerance (<0.02), proving it faithfully implements the biology.

**Tools & infrastructure.**
- **Engine:** Python 3, **PyTorch** (CUDA), NumPy reference. Device auto-selects CUDA → MPS → CPU.
- **Server:** **FastAPI + Uvicorn** — one async process steps the engine on the GPU and streams state over a **WebSocket**. A compact **binary frame protocol** (little-endian header + `uint8` state grid + quantized `uint8` oxygen + optional `float16` attention block) keeps the live stream light; JSON only for controls and stats (tumor + infected fractions).
- **Frontend:** **React + TypeScript + Vite**, **raw WebGL2** (a single full-screen quad samples an `R8UI` state texture + oxygen texture; a fragment shader does the palette, soft-disc "alive cell" shaping, oxygen underlay, and the continuous body→tissue→cell camera zoom), **zustand** for state, and `<canvas>` for the live order-parameter chart (tumor + infected lines), attention overlay, and viridis phase map. High-rate grid frames bypass React entirely and feed the GPU directly.
- **Decoupled sim/render:** the engine runs server-side on the H100; the browser only paints — also the honest infra story.
- **Deployment:** a single FastAPI port serves both the built frontend and the WebSocket, so one public URL runs the whole demo. Deployed on a **Prime Intellect H100 pod** and exposed publicly via a **Cloudflare tunnel** (`cloudflared`).

**One-line architecture:** `WebGL2 browser ⇄ WebSocket ⇄ FastAPI async loop ⇄ batched PyTorch neighborhood-attention transformer on an H100`.

**Future trajectory:** today the interaction weights are hand-set (interpretable — you can point at the oxygen head, the crowding head). The frontier is *learning* them from perturbation data (perturb-seq, CRISPR screens, microscopy): a transformer runs fast on the ASIC **and** is trainable from that data; a CUDA kernel is neither. That closes a flywheel — more compute → simulate more → generate more data → learn a better engine — toward a foundation model of cell dynamics.
