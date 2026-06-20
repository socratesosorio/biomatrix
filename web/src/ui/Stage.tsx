import { useEffect, useRef } from "react";
import { Renderer } from "../gl/renderer";
import { liveFrame, useStore, Scene } from "../state";
import { sendSpawn, sendFocus, sendClearFocus } from "../net/ws";

interface CamState {
  centerX: number;
  centerY: number;
  coverage: number;
  cellShape: number;
  bodyMix: number;   // 1 = body silhouette visible
  overlayMix: number; // 1 = attention overlay visible
}

// per-scene camera targets
function sceneTarget(scene: Scene, focus: { x: number; y: number } | null, grid: number): CamState {
  const fx = focus ? (focus.x + 0.5) / grid : 0.5;
  const fy = focus ? (focus.y + 0.5) / grid : 0.5;
  switch (scene) {
    case "body":
      return { centerX: 0.5, centerY: 0.5, coverage: 2.6, cellShape: 0.0, bodyMix: 1, overlayMix: 0 };
    case "tissue":
      return { centerX: 0.5, centerY: 0.5, coverage: 1.0, cellShape: 0.28, bodyMix: 0, overlayMix: 0 };
    case "cell":
      return { centerX: fx, centerY: fy, coverage: 0.10, cellShape: 1.0, bodyMix: 0, overlayMix: 1 };
    case "map":
      return { centerX: 0.5, centerY: 0.5, coverage: 1.0, cellShape: 0.28, bodyMix: 0, overlayMix: 0 };
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function Stage() {
  const glCanvas = useRef<HTMLCanvasElement>(null);
  const overlayCanvas = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const camRef = useRef<CamState>({
    centerX: 0.5, centerY: 0.5, coverage: 2.6, cellShape: 0, bodyMix: 1, overlayMix: 0,
  });

  const scene = useStore((s) => s.scene);
  const split = useStore((s) => s.split);
  const grid = useStore((s) => s.grid);
  const focusCell = useStore((s) => s.focusCell);
  const setFocusCell = useStore((s) => s.setFocusCell);

  // keep the latest reactive values available to the rAF loop
  const refs = useRef({ scene, split, grid, focusCell });
  refs.current = { scene, split, grid, focusCell };

  useEffect(() => {
    if (!glCanvas.current) return;
    const renderer = new Renderer(glCanvas.current);
    rendererRef.current = renderer;
    let raf = 0;

    const loop = () => {
      const cv = glCanvas.current!;
      const ov = overlayCanvas.current!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth, h = cv.clientHeight;
      const W = Math.max(1, Math.floor(w * dpr)), H = Math.max(1, Math.floor(h * dpr));
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      if (ov.width !== W || ov.height !== H) { ov.width = W; ov.height = H; }

      const { scene, split, grid, focusCell } = refs.current;
      const target = sceneTarget(scene, focusCell, grid);
      const cam = camRef.current;
      const t = 0.10;
      cam.centerX = lerp(cam.centerX, target.centerX, t);
      cam.centerY = lerp(cam.centerY, target.centerY, t);
      cam.coverage = lerp(cam.coverage, target.coverage, t);
      cam.cellShape = lerp(cam.cellShape, target.cellShape, t);
      cam.bodyMix = lerp(cam.bodyMix, target.bodyMix, t);
      cam.overlayMix = lerp(cam.overlayMix, target.overlayMix, t);

      renderer.cam.centerX = cam.centerX;
      renderer.cam.centerY = cam.centerY;
      renderer.cam.coverage = cam.coverage;
      renderer.cam.cellShape = cam.cellShape;
      renderer.cam.vignette = 1.0;
      renderer.split = split;
      renderer.focus = focusCell;
      renderer.render(W, H);

      drawOverlay(ov, cam, refs.current);

      // body silhouette opacity
      const bodyEl = document.getElementById("body-layer");
      if (bodyEl) bodyEl.style.opacity = String(cam.bodyMix);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // when entering cell scene, focus the grid center if nothing focused
  useEffect(() => {
    if (scene === "cell") {
      const f = focusCell ?? { x: Math.floor(grid / 2), y: Math.floor(grid / 2) };
      if (!focusCell) setFocusCell(f);
      sendFocus(f.x, f.y);
    } else {
      sendClearFocus();
    }
  }, [scene]);

  // map screen pixel -> grid cell using the same transform as the shader
  function screenToCell(px: number, py: number): { x: number; y: number } {
    const cv = glCanvas.current!;
    const rect = cv.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    let ax = 1, ay = 1;
    if (aspect >= 1) ax = aspect; else ay = 1 / aspect;
    const cam = camRef.current;
    let uvx = (px - rect.left) / rect.width;
    let uvy = 1 - (py - rect.top) / rect.height;
    // undo split remap (use left panel for picking)
    if (refs.current.split && liveFrame.B >= 2) {
      uvx = uvx < 0.5 ? uvx * 2 : (uvx - 0.5) * 2;
    }
    const gx = cam.centerX + (uvx - 0.5) * cam.coverage * ax;
    const gy = cam.centerY + (uvy - 0.5) * cam.coverage * ay;
    return {
      x: Math.max(0, Math.min(grid - 1, Math.floor(gx * grid))),
      y: Math.max(0, Math.min(grid - 1, Math.floor(gy * grid))),
    };
  }

  function onClick(e: React.MouseEvent) {
    const cell = screenToCell(e.clientX, e.clientY);
    if (refs.current.scene === "cell") {
      setFocusCell(cell);
      sendFocus(cell.x, cell.y);
    } else {
      sendSpawn(cell.x, cell.y, 5);
    }
  }

  return (
    <div className="stage">
      <canvas ref={glCanvas} className="gl-canvas" onClick={onClick} />
      <canvas ref={overlayCanvas} className="overlay-canvas" />
      <BodyLayer />
      <div className="scene-hint">
        {scene === "tissue" && "click tissue to seed a tumor"}
        {scene === "cell" && "click a cell to inspect its attention"}
      </div>
    </div>
  );
}

// draw the cell-cell-signaling attention overlay (lines focused-cell -> neighbors)
function drawOverlay(
  ov: HTMLCanvasElement,
  cam: CamState,
  refs: { grid: number; split: boolean; focusCell: { x: number; y: number } | null }
) {
  const ctx = ov.getContext("2d")!;
  ctx.clearRect(0, 0, ov.width, ov.height);
  if (cam.overlayMix < 0.02) return;
  const f = liveFrame.focus;
  if (!f) return;

  const grid = refs.grid;
  const aspect = ov.width / ov.height;
  let ax = 1, ay = 1;
  if (aspect >= 1) ax = aspect; else ay = 1 / aspect;

  const cellToScreen = (cx: number, cy: number) => {
    const tuvx = (cx + 0.5) / grid;
    const tuvy = (cy + 0.5) / grid;
    let sx = 0.5 + (tuvx - cam.centerX) / (cam.coverage * ax);
    let sy = 0.5 + (tuvy - cam.centerY) / (cam.coverage * ay);
    return { x: sx * ov.width, y: (1 - sy) * ov.height };
  };

  const offsets = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [0, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ];
  const center = cellToScreen(f.x, f.y);
  const tnow = performance.now() / 1000;

  ctx.lineCap = "round";
  for (let i = 0; i < 9; i++) {
    if (i === 4) continue; // skip self
    const [dx, dy] = offsets[i];
    const p = cellToScreen(f.x + dx, f.y + dy);
    const wgt = f.attn[i];
    const op = Math.min(1, wgt * 6) * cam.overlayMix;
    if (op < 0.02) continue;
    // animated dashed line = signal flowing
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -(tnow * 40) % 20;
    ctx.strokeStyle = `rgba(120,230,255,${op})`;
    ctx.lineWidth = 1 + wgt * 8;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    // neighbor node
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(180,245,255,${op})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + wgt * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // focused cell node
  ctx.setLineDash([]);
  ctx.fillStyle = `rgba(255,240,140,${cam.overlayMix})`;
  ctx.beginPath();
  ctx.arc(center.x, center.y, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "13px ui-monospace, monospace";
  ctx.fillStyle = `rgba(160,230,255,${cam.overlayMix})`;
  ctx.fillText("attention = cell-cell signaling", 16, ov.height - 18);
}

function BodyLayer() {
  return (
    <div id="body-layer" className="body-layer">
      <svg viewBox="0 0 200 320" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff2d72" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#ff2d72" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ff2d72" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g fill="#11202b" stroke="#1d3a4a" strokeWidth="1.5">
          <circle cx="100" cy="40" r="24" />
          <rect x="74" y="66" width="52" height="92" rx="20" />
          <rect x="52" y="74" width="22" height="80" rx="11" />
          <rect x="126" y="74" width="22" height="80" rx="11" />
          <rect x="80" y="150" width="18" height="110" rx="9" />
          <rect x="102" y="150" width="18" height="110" rx="9" />
        </g>
        <circle cx="112" cy="110" r="42" fill="url(#glow)">
          <animate attributeName="r" values="34;46;34" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx="112" cy="110" r="6" fill="#ff5b8f" />
      </svg>
      <div className="body-caption">primary tumor site</div>
    </div>
  );
}
