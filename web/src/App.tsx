import { useEffect } from "react";
import Stage from "./ui/Stage";
import Controls from "./ui/Controls";
import OrderParam from "./ui/OrderParam";
import PhaseMap from "./ui/PhaseMap";
import { useStore } from "./state";
import { connect } from "./net/ws";

// Same-origin WS when served by the FastAPI app (deploy); falls back to the
// standalone dev server on :8000 when running `npm run dev` against `python -m
// server.server`. Override with VITE_WS_URL.
function defaultWsUrl(): string {
  const env = (import.meta as any).env?.VITE_WS_URL;
  if (env) return env;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  // Vite dev server runs on 5173; the standalone WS server is on 8000.
  if (location.port === "5173") return `ws://${location.hostname}:8000`;
  return `${proto}://${location.host}/ws`;
}
const WS_URL = defaultWsUrl();

export default function App() {
  const connected = useStore((s) => s.connected);
  const device = useStore((s) => s.device);
  const scene = useStore((s) => s.scene);

  useEffect(() => {
    connect(WS_URL);
  }, []);

  return (
    <div className="app">
      <div className="main">
        <Stage />
        {scene === "map" && (
          <div className="map-overlay">
            <PhaseMap />
          </div>
        )}
        <div className="chart-dock">
          <OrderParam />
        </div>
        <div className={connected ? "conn ok" : "conn bad"}>
          {connected ? `live · ${device}` : "connecting…"}
        </div>
      </div>
      <div className="side">
        <Controls />
      </div>
    </div>
  );
}
