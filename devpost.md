# BioMatrix

*A living tissue where every timestep is a transformer forward pass - and a slider drives a real, falsifiable transition from health to cancer.*

**Live demo:** https://believe-use-listprice-lending.trycloudflare.com (running on an NVIDIA H100)

---

## Inspiration

We started from one observation that wouldn't let go of us: **cell-to-cell signaling is attention.** A cell decides what to do next by weighing signals from its neighbors - which is the exact operation a transformer performs. Biology has been running "attention" for a billion years; we just recognized the shape and wrote the dynamics in it.

That reframes everything. If a tissue's dynamics are attention, then **a timestep is a forward pass**, and **simulating biology is running inference** - no gradients, no training, just the world stepped forward. So a chip built for inference throughput (like Etched's) isn't a model server; it's a *scientific instrument*. Etched's prompt was "build as if compute is free." We took it literally: if forward passes are free, you can run the world forward millions of times in parallel and discover the things you could never predict by hand.

## What it does

BioMatrix simulates living tissue in real time, with the engine running server-side on an H100 and streaming state to your browser.

- **It's a real transformer.** Each timestep gathers every cell's 3×3 neighborhood (windowed attention), and an MLP samples the cell's next state - sampling the forward pass, exactly like LLM token sampling.
- **A falsifiable phase transition.** Drag the **Aggression** slider and the tissue flips, at a sharp critical threshold, from healthy homeostasis to runaway cancer - with a live order-parameter chart spiking. Below the threshold cancer goes extinct every time; above it, it explodes every time.
- **Two diseases, one engine.** A **virus** (a spatial SEIR epidemic with a diffusing viral-load field) drops into the *same* tissue with zero changes to the cancer rules. Healthy cells are silently infected, turn contagious, and die - an orange infection front with a hidden latent edge running ahead of it.
- **Thousands of simulations in parallel.** One click runs ~2,300 full tissues at once - every combination of aggression and immunity - as a single batched forward pass on the H100, rendering the phase diagram of "where cancer wins." Click any pixel to drop into that regime.
- **Zoom from body → tissue → single cell**, where the actual attention weights light up as cell-to-cell signal edges.

## How we built it

- **Engine (PyTorch, CUDA):** neighborhood attention over a 3×3 window via `unfold`, with hand-set attention heads that compute the exact neighbor aggregates the biology needs - no training required, fully interpretable. The MLP transition samples the next state. Everything carries a batch dimension so we can run one seed, two seeds, or thousands at once.
- **Verification first:** we built a NumPy reference CA and proved the phase transition was real *before* any GPU or UI work, then asserted the transformer's transition curve overlays the reference within tolerance (<0.02) - so the transformer provably implements the biology.
- **Server (FastAPI + Uvicorn):** one async loop steps the engine on the GPU and streams a compact **binary WebSocket protocol** (uint8 state grid + quantized oxygen + a float16 attention block); JSON only for controls and stats.
- **Frontend (React + TypeScript + raw WebGL2):** a single full-screen quad samples the state/oxygen textures; a fragment shader does the palette, soft-disc "living cell" shaping, and the continuous body→tissue→cell camera zoom. High-rate frames bypass React and feed the GPU directly.
- **Deployment:** one FastAPI port serves both the built frontend and the WebSocket, so a single public URL runs the whole demo - deployed on a **Prime Intellect H100 pod** and exposed via a Cloudflare tunnel.

## Challenges we ran into

- **Making it a *real* transformer, not a metaphor.** We had to implement the rules literally as softmax attention and prove the aggregate heads compute neighbor counts and the oxygen Laplacian *exactly* (a border-padding bug initially made cells spuriously necrose - fixed by matching the reference's edge padding).
- **Earning a crisp phase transition.** Tuning the dynamics so the knee is sharp, reproducible, and sits at a convenient slider position took a dedicated verification sweep.
- **Deploying on real silicon.** GPU sandboxes were beta-locked on our account, so we pivoted to a Prime Intellect H100 pod and an outbound Cloudflare tunnel to get one clean public link - with the engine genuinely on CUDA.
- **Adding the virus without breaking cancer.** We extended the state space and reused the existing attention machinery purely additively, keeping the cancer rules bit-identical (verified).

## Accomplishments that we're proud of

- The engine is **genuinely a transformer**, verified against a reference - not a CA wearing a logo.
- It's **live on an H100**, streaming real forward passes to a browser at 30 fps.
- A **falsifiable, reproducible phase transition** you can drive with your hand - the demo wins on rigor, not animation.
- **Composability proven:** a completely different disease runs on the same substrate with zero engine changes.
- **Thousands of forward passes in parallel** producing a phase diagram in seconds - "inference-time compute" made literal.

## What we learned

- **Emergence is the product, and emergence is compute-bound.** The rules are simple and known; what they *imply* is not. The virus's most dangerous trait - silent spread from the latent period - is emergent. We never coded it.
- **Interacting diseases confound.** When tumor and virus overlap, their signatures mask each other and you cannot attribute cause by inspection - you have to run the counterfactuals and diff them. Confounding isn't a visualization problem; it's a parallel-compute problem.
- **Near criticality, a single run lies.** Two seeds with identical parameters diverge - one extinct, one explosive. Where the science is interesting, the system is chaotic, so you need the *ensemble*, not one trajectory. That's the real scientific case for near-infinite parallel compute.
- **Simulation is inference.** Recognizing there are no gradients anywhere reframed what the hardware is *for*.

## What's next for BioMatrix

Today our interaction weights are hand-set - which makes them interpretable (we can point at the oxygen head, the crowding head). But biology won't hand us its true weights the way Newton handed Mujoco its physics. So the frontier is **learning them from perturbation data** - perturb-seq, CRISPR screens, live-cell microscopy. A transformer runs fast on the ASIC *and* is trainable from that data; a CUDA kernel is neither. That closes a flywheel: **more compute → simulate more → generate more data → learn a better engine** - toward a foundation model of cell dynamics.

From there: drop in more agents on the same substrate (drugs, gene knockouts, second pathogens), shard ensembles across an 8×H100 box for the chaotic regimes, and turn the slider-dragging into automated search - for the intervention that collapses the tumor, before anyone touches a patient.

*Cell signaling is attention, so simulating biology is running forward passes - which turns a transformer chip into an instrument for running the world forward, in parallel, to discover the things we can't predict by hand.*
