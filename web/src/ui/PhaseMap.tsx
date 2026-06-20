import { useEffect, useRef } from "react";
import { useStore } from "../state";
import { sendParamsNow, sendReset } from "../net/ws";

// compact viridis approximation
function viridis(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  const stops: [number, number, number][] = [
    [68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37],
  ];
  const f = t * (stops.length - 1);
  const i = Math.floor(f);
  const r = f - i;
  if (i >= stops.length - 1) return stops[stops.length - 1];
  const a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r, a[2] + (b[2] - a[2]) * r];
}

export default function PhaseMap() {
  const sweep = useStore((s) => s.sweep);
  const sweepRunning = useStore((s) => s.sweepRunning);
  const setScene = useStore((s) => s.setScene);
  const setParams = useStore((s) => s.setParams);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!sweep || !canvasRef.current) return;
    const { res, grid } = sweep;
    const cv = canvasRef.current;
    const scale = 16;
    cv.width = res * scale;
    cv.height = res * scale;
    const ctx = cv.getContext("2d")!;
    for (let r = 0; r < res; r++) {
      for (let c = 0; c < res; c++) {
        // data: rows=immune(b), cols=aggression(a). Flip rows so low immune at bottom.
        const v = grid[r * res + c];
        const [R, G, B] = viridis(v);
        ctx.fillStyle = `rgb(${R | 0},${G | 0},${B | 0})`;
        // draw with row 0 (low immune) at bottom
        ctx.fillRect(c * scale, (res - 1 - r) * scale, scale, scale);
      }
    }
  }, [sweep]);

  if (!sweep) {
    return (
      <div className="phasemap-empty">
        {sweepRunning ? (
          <div className="sweep-spinner">
            running the sweep… thousands of forward passes in parallel
          </div>
        ) : (
          <div>No phase map yet — hit “Run phase sweep”.</div>
        )}
      </div>
    );
  }

  const onClick = (e: React.MouseEvent) => {
    const cv = canvasRef.current!;
    const rect = cv.getBoundingClientRect();
    const res = sweep.res;
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * res);
    const rDisp = Math.floor(((e.clientY - rect.top) / rect.height) * res);
    const r = res - 1 - rDisp; // undo flip
    const a = sweep.rangeA[0] + (sweep.rangeA[1] - sweep.rangeA[0]) * (c / (res - 1));
    const b = sweep.rangeB[0] + (sweep.rangeB[1] - sweep.rangeB[0]) * (r / (res - 1));
    const upd = { [sweep.axisA]: a, [sweep.axisB]: b } as any;
    setParams(upd);
    sendParamsNow(upd);
    sendReset(Math.floor(Math.random() * 1e6), upd);
    setScene("tissue");
  };

  return (
    <div className="phasemap">
      <div className="pm-head">
        Phase diagram — each pixel is a full simulation. Click to load that regime.
      </div>
      <div className="pm-body">
        <div className="pm-yaxis">{sweep.axisB} →</div>
        <canvas ref={canvasRef} className="pm-canvas" onClick={onClick} />
      </div>
      <div className="pm-xaxis">{sweep.axisA} →  (bright = cancer wins)</div>
    </div>
  );
}
