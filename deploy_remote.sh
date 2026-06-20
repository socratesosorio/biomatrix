#!/usr/bin/env bash
# Runs ON the H100 pod. Unpacks the app, installs the few missing deps,
# launches the FastAPI app on the GPU, and opens a public cloudflared tunnel.
set -uo pipefail

cd "$HOME"
echo "[deploy] user=$(whoami) home=$HOME"
rm -rf tissue && mkdir -p tissue && cd tissue
tar xzf "$HOME/tissue_deploy.tar.gz"
touch engine/__init__.py server/__init__.py 2>/dev/null || true

echo "[deploy] python: $(python -c 'import sys;print(sys.version.split()[0])')"
python - <<'PY'
import torch
print("[deploy] torch", torch.__version__, "cuda_available", torch.cuda.is_available(),
      "device", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu")
PY

echo "[deploy] installing fastapi/uvicorn ..."
pip install -q --no-input fastapi "uvicorn[standard]" >/tmp/pip.log 2>&1 \
  || pip install -q --no-input --user fastapi "uvicorn[standard]" >>/tmp/pip.log 2>&1 \
  || { echo "[deploy] pip failed"; tail -20 /tmp/pip.log; }

# cloudflared (no account needed for a quick tunnel)
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "[deploy] fetching cloudflared ..."
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    -o "$HOME/cloudflared" && chmod +x "$HOME/cloudflared"
  CF="$HOME/cloudflared"
else
  CF="$(command -v cloudflared)"
fi

# launch the app on the GPU
export CA_DEVICE=cuda CA_GRID=192 CA_SWEEP_GRID=56
pkill -f "uvicorn server.app" 2>/dev/null || true
sleep 1
nohup python -m uvicorn server.app:app --host 0.0.0.0 --port 8000 > "$HOME/app.log" 2>&1 &
echo "[deploy] uvicorn starting (pid $!) ..."

# wait for health
for i in $(seq 1 40); do
  if curl -s --max-time 2 http://localhost:8000/api/health | grep -q '"ok":true'; then
    echo "[deploy] HEALTH: $(curl -s http://localhost:8000/api/health)"
    break
  fi
  sleep 1
done

# start the public tunnel
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1
nohup "$CF" tunnel --no-autoupdate --url http://localhost:8000 > "$HOME/cf.log" 2>&1 &
echo "[deploy] cloudflared starting (pid $!) ..."
for i in $(seq 1 30); do
  URL=$(grep -oE 'https://[a-z0-9.-]+\.trycloudflare\.com' "$HOME/cf.log" | head -1)
  if [ -n "$URL" ]; then
    echo "[deploy] PUBLIC_URL=$URL"
    break
  fi
  sleep 1
done
[ -z "${URL:-}" ] && { echo "[deploy] no tunnel URL yet; cf.log:"; tail -20 "$HOME/cf.log"; }
echo "[deploy] done"
