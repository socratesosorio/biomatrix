import { useStore, Params, Scene } from "../state";
import {
  sendParams, sendPlay, sendPause, sendReset, sendSpawn, sendSplit,
  sendPreset, sendSpeed, sendSweep, sendReleaseVirus,
} from "../net/ws";

interface SliderDef {
  key: keyof Params;
  label: string;
  min: number;
  max: number;
  step: number;
  hero?: boolean;
}

const SLIDERS: SliderDef[] = [
  { key: "aggression", label: "Aggression", min: 0, max: 1, step: 0.005, hero: true },
  { key: "immune", label: "Immune", min: 0, max: 0.5, step: 0.005, hero: true },
  { key: "mutation", label: "Mutation", min: 0, max: 0.01, step: 0.0002 },
  { key: "o_source", label: "Oxygen supply", min: 0.01, max: 0.08, step: 0.001 },
  { key: "infectivity", label: "Infectivity", min: 0, max: 1, step: 0.005 },
  { key: "latent_period", label: "Latent period", min: 1, max: 20, step: 1 },
];

// mirror engine/params.py presets so the sliders track loaded presets
const PRESET_VALUES: Record<string, Partial<Params>> = {
  HEALTHY: { aggression: 0.2, immune: 0.3, mutation: 0.0005, o_source: 0.05 },
  NEAR_CRITICAL: { aggression: 0.34, immune: 0.18, mutation: 0.0008, o_source: 0.045 },
  MONEY_SHOT: { aggression: 0.48, immune: 0.18, mutation: 0.0008, o_source: 0.042 },
};

export default function Controls() {
  const params = useStore((s) => s.params);
  const setParam = useStore((s) => s.setParam);
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);
  const split = useStore((s) => s.split);
  const setSplit = useStore((s) => s.setSplit);
  const scene = useStore((s) => s.scene);
  const setScene = useStore((s) => s.setScene);
  const grid = useStore((s) => s.grid);
  const sweepRunning = useStore((s) => s.sweepRunning);

  const onSlide = (k: keyof Params, v: number) => {
    setParam(k, v);
    if (k === "speed") sendSpeed(v);
    else sendParams({ [k]: v } as Partial<Params>);
  };

  const togglePlay = () => {
    if (playing) { sendPause(); setPlaying(false); }
    else { sendPlay(); setPlaying(true); }
  };

  const reset = () => sendReset(Math.floor(Math.random() * 1e6), params);

  const goScene = (s: Scene) => {
    setScene(s);
    if (s === "map") {
      const { sweep, sweepRunning } = useStore.getState();
      if (!sweep && !sweepRunning) sendSweep(48, 220);
    }
  };

  const loadPreset = (name: string) => {
    sendPreset(name);
    const vals = PRESET_VALUES[name];
    if (vals) useStore.getState().setParams(vals);
  };

  return (
    <div className="controls">
      <div className="title">
        <span className="dot" /> Living Tissue
        <span className="subtitle">transformer · {grid}×{grid}</span>
      </div>

      <div className="scenes">
        {(["body", "tissue", "cell", "map"] as Scene[]).map((s) => (
          <button
            key={s}
            className={scene === s ? "scene active" : "scene"}
            onClick={() => goScene(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="presets">
        <button onClick={() => loadPreset("HEALTHY")}>Homeostasis</button>
        <button onClick={() => loadPreset("NEAR_CRITICAL")}>Near-critical</button>
        <button onClick={() => loadPreset("MONEY_SHOT")}>Bloom</button>
      </div>

      {SLIDERS.map((sl) => (
        <div className={sl.hero ? "slider hero" : "slider"} key={sl.key}>
          <label>
            <span>{sl.label}{sl.hero ? " ★" : ""}</span>
            <span className="val">{params[sl.key].toFixed(sl.step < 0.001 ? 4 : 3)}</span>
          </label>
          <input
            type="range"
            min={sl.min}
            max={sl.max}
            step={sl.step}
            value={params[sl.key]}
            onChange={(e) => onSlide(sl.key, parseFloat(e.target.value))}
          />
        </div>
      ))}

      <div className="slider">
        <label><span>Speed</span><span className="val">{params.speed}/s</span></label>
        <input
          type="range" min={1} max={60} step={1}
          value={params.speed}
          onChange={(e) => onSlide("speed", parseInt(e.target.value))}
        />
      </div>

      <div className="buttons">
        <button onClick={togglePlay}>{playing ? "Pause" : "Play"}</button>
        <button onClick={reset}>Reset</button>
        <button onClick={() => sendSpawn(Math.floor(grid / 2), Math.floor(grid / 2), 6)}>
          Spawn
        </button>
        <button
          className={split ? "active" : ""}
          onClick={() => { const v = !split; setSplit(v); sendSplit(v); }}
        >
          Split seeds
        </button>
        <button
          className="virus-btn"
          onClick={() => sendReleaseVirus(Math.floor(grid / 2), Math.floor(grid / 2), 5)}
        >
          Release virus
        </button>
      </div>

      <button
        className="sweep-btn"
        disabled={sweepRunning}
        onClick={() => { sendSweep(48, 220); }}
      >
        {sweepRunning ? "Sweeping… (forward passes in parallel)" : "Run phase sweep"}
      </button>

      <p className="thesis">
        Every timestep is a transformer forward pass. Cell–cell signaling is
        attention. Drag <b>Aggression</b> across the critical point and watch
        homeostasis flip to runaway cancer.
      </p>
    </div>
  );
}
