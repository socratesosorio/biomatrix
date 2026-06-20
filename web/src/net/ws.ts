import { liveFrame, useStore, Params } from "../state";

const MAGIC = 0xca77;
const FLAG_FOCUS = 0x01;

// half-precision -> float32 (DataView.getFloat16 is too new to rely on)
function halfToFloat(h: number): number {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  if (e === 0x1f) return f ? NaN : (s ? -1 : 1) * Infinity;
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}

function decodeFrame(buf: ArrayBuffer) {
  const dv = new DataView(buf);
  let o = 0;
  const magic = dv.getUint16(o, true); o += 2;
  if (magic !== MAGIC) return;
  const tick = dv.getUint32(o, true); o += 4;
  const W = dv.getUint16(o, true); o += 2;
  const H = dv.getUint16(o, true); o += 2;
  const B = dv.getUint8(o); o += 1;
  const flags = dv.getUint8(o); o += 1;

  const n = B * H * W;
  const state = new Uint8Array(buf, o, n); o += n;
  const oxygen = new Uint8Array(buf, o, n); o += n;

  let focus: { x: number; y: number; attn: Float32Array } | null = null;
  if (flags & FLAG_FOCUS) {
    const fx = dv.getUint16(o, true); o += 2;
    const fy = dv.getUint16(o, true); o += 2;
    const attn = new Float32Array(9);
    for (let i = 0; i < 9; i++) {
      attn[i] = halfToFloat(dv.getUint16(o, true)); o += 2;
    }
    focus = { x: fx, y: fy, attn };
  }

  // copy into persistent buffers (subarray views share the WS buffer which may
  // be reused; copy to be safe)
  liveFrame.W = W;
  liveFrame.H = H;
  liveFrame.B = B;
  liveFrame.tick = tick;
  if (liveFrame.state.length !== n) {
    liveFrame.state = new Uint8Array(n);
    liveFrame.oxygen = new Uint8Array(n);
  }
  liveFrame.state.set(state);
  liveFrame.oxygen.set(oxygen);
  liveFrame.focus = focus;
  liveFrame.version++;
}

let socket: WebSocket | null = null;

export function connect(url: string) {
  const store = useStore.getState();
  socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";

  socket.onopen = () => store.setConnected(true);
  socket.onclose = () => {
    store.setConnected(false);
    // auto-reconnect
    setTimeout(() => connect(url), 1000);
  };
  socket.onerror = () => socket?.close();

  socket.onmessage = (ev) => {
    if (ev.data instanceof ArrayBuffer) {
      decodeFrame(ev.data);
      return;
    }
    let msg: any;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    const s = useStore.getState();
    switch (msg.type) {
      case "hello":
        s.setHello(msg.grid, msg.device, msg.params as Params, msg.playing);
        break;
      case "stats":
        s.pushStats(msg.tumor_fraction, msg.necrotic_fraction);
        break;
      case "ack":
        if (msg.what === "sweep_started") s.setSweepRunning(true);
        break;
      case "sweep_result":
        s.setSweep({
          axisA: msg.axisA,
          rangeA: msg.rangeA,
          axisB: msg.axisB,
          rangeB: msg.rangeB,
          res: msg.res,
          grid: msg.grid,
        });
        s.setSweepRunning(false);
        break;
    }
  };
}

function send(obj: any) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(obj));
  }
}

// ---- typed senders ----
let lastParamSend = 0;
export function sendParams(params: Partial<Params>) {
  const now = performance.now();
  if (now - lastParamSend < 90) return; // throttle ~10/s
  lastParamSend = now;
  send({ type: "set_params", params });
}
export function sendParamsNow(params: Partial<Params>) {
  send({ type: "set_params", params });
}
export function sendReset(seed: number, params?: Partial<Params>) {
  send({ type: "reset", seed, params });
}
export function sendPreset(name: string) {
  send({ type: "preset", name });
}
export function sendPlay() { send({ type: "play" }); }
export function sendPause() { send({ type: "pause" }); }
export function sendSpeed(ticks_per_sec: number) {
  send({ type: "set_speed", ticks_per_sec });
}
export function sendSpawn(x: number, y: number, radius = 5) {
  send({ type: "spawn", x, y, radius });
}
export function sendFocus(x: number, y: number) {
  send({ type: "focus", x, y });
}
export function sendClearFocus() { send({ type: "focus", clear: true }); }
export function sendSplit(on: boolean) { send({ type: "split", on }); }
export function sendSweep(res = 24, steps = 200) {
  send({ type: "sweep", res, steps });
}
