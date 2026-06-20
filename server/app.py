"""Single-port FastAPI app: serves the built frontend (web/dist) AND the
WebSocket on one port, so a single public URL runs the whole demo (same-origin
ws). This is what gets deployed to the GPU box.

Run:  uvicorn server.app:app --host 0.0.0.0 --port 8000
Env:  CA_DEVICE=cpu|cuda  CA_GRID=192  CA_SWEEP_GRID=48  CA_DIST=web/dist
"""

from __future__ import annotations

import asyncio
import json
import os
import functools

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from engine.sweep import run_auto as sweep_run
from server.sim import SimState, GRID

DIST = os.environ.get("CA_DIST", os.path.join(os.path.dirname(__file__), "..", "web", "dist"))
DIST = os.path.abspath(DIST)

app = FastAPI()
SIM = SimState(GRID)
CLIENTS: set[WebSocket] = set()
SWEEP_LOCK = asyncio.Lock()


async def broadcast(message):
    if not CLIENTS:
        return
    dead = []
    for ws in list(CLIENTS):
        try:
            if isinstance(message, (bytes, bytearray)):
                await ws.send_bytes(message)
            else:
                await ws.send_text(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        CLIENTS.discard(ws)


async def sim_loop():
    while True:
        if SIM.playing and CLIENTS:
            SIM.step()
            await broadcast(SIM.build_frame())
            if SIM.engine.tick % 3 == 0:
                await broadcast(SIM.build_stats())
        await asyncio.sleep(1.0 / max(1, SIM.ticks_per_sec))


async def run_sweep(cfg):
    if SWEEP_LOCK.locked():
        return
    async with SWEEP_LOCK:
        await broadcast(json.dumps({"type": "ack", "what": "sweep_started"}))
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, functools.partial(sweep_run, cfg, SIM.params))
        result["type"] = "sweep_result"
        await broadcast(json.dumps(result))


@app.on_event("startup")
async def _startup():
    asyncio.create_task(sim_loop())
    print(f"[tissue] grid={SIM.grid}x{SIM.grid} device={SIM.device} gpus={SIM._gpu_info()} dist={DIST}")


@app.get("/api/health")
async def health():
    return JSONResponse({
        "ok": True,
        "grid": SIM.grid,
        "device": str(SIM.device),
        "gpus": SIM._gpu_info(),
        "tick": SIM.engine.tick,
        "clients": len(CLIENTS),
    })


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    CLIENTS.add(ws)
    try:
        await ws.send_text(SIM.hello())
        await ws.send_bytes(SIM.build_frame())
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                continue
            broadcast_now, sweep_cfg = SIM.handle(msg)
            if broadcast_now:
                await broadcast(SIM.build_frame())
            if sweep_cfg is not None:
                asyncio.create_task(run_sweep(sweep_cfg))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        CLIENTS.discard(ws)


# ---- static frontend (mounted last so /ws and /api win) ----
if os.path.isdir(os.path.join(DIST, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST, "assets")), name="assets")


@app.get("/")
async def index():
    return FileResponse(os.path.join(DIST, "index.html"))


@app.get("/{path:path}")
async def spa(path: str):
    # serve real files if present, else fall back to index.html (SPA)
    candidate = os.path.join(DIST, path)
    if os.path.isfile(candidate):
        return FileResponse(candidate)
    return FileResponse(os.path.join(DIST, "index.html"))
