import { useEffect, useRef } from "react";
import { useStore } from "../state";

const BATCH_COLORS = ["#ff2d72", "#39d0ff"];

export default function OrderParam() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const cv = canvasRef.current!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth, h = cv.clientHeight;
      const W = Math.floor(w * dpr), H = Math.floor(h * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const ctx = cv.getContext("2d")!;
      ctx.clearRect(0, 0, W, H);

      // background
      ctx.fillStyle = "rgba(10,14,20,0.85)";
      ctx.fillRect(0, 0, W, H);

      // critical region shading (tumor_fraction between ~0.1 and ~0.4 = the knee)
      const yFor = (v: number) => H - v * H;
      ctx.fillStyle = "rgba(255,180,60,0.10)";
      ctx.fillRect(0, yFor(0.45), W, yFor(0.12) - yFor(0.45));

      // gridlines
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      for (let g = 0; g <= 4; g++) {
        const y = (H * g) / 4;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      const { series } = useStore.getState().stats;
      for (let b = 0; b < series.length; b++) {
        const data = series[b];
        if (!data || data.length < 2) continue;
        ctx.strokeStyle = BATCH_COLORS[b % BATCH_COLORS.length];
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        const n = data.length;
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * W;
          const y = yFor(Math.min(1, data[i]));
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        // current value dot
        const last = data[n - 1];
        ctx.fillStyle = BATCH_COLORS[b % BATCH_COLORS.length];
        ctx.beginPath();
        ctx.arc(W - 4, yFor(Math.min(1, last)), 4 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // labels
      ctx.fillStyle = "rgba(220,230,240,0.7)";
      ctx.font = `${11 * dpr}px ui-monospace, monospace`;
      ctx.fillText("order parameter: tumor fraction", 8 * dpr, 16 * dpr);
      ctx.fillText("1.0", 8 * dpr, 12 * dpr + H * 0);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const last = useStore((s) => s.lastTumorFraction);

  return (
    <div className="orderparam">
      <canvas ref={canvasRef} />
      <div className="op-readout">
        {last.map((v, i) => (
          <span key={i} style={{ color: BATCH_COLORS[i % BATCH_COLORS.length] }}>
            {(v * 100).toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  );
}
