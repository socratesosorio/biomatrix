import { create } from "zustand";

export interface Params {
  aggression: number;
  immune: number;
  mutation: number;
  o_source: number;
  speed: number;
  infectivity: number;
  latent_period: number;
}

export interface SweepResult {
  axisA: string;
  rangeA: [number, number];
  axisB: string;
  rangeB: [number, number];
  res: number;
  grid: number[];
}

// "Scenes" the camera animates between.
export type Scene = "body" | "tissue" | "cell" | "map";

// ---- High-rate frame buffer: lives OUTSIDE React so 30fps grid updates
// never trigger re-renders. The renderer reads this each rAF. ----
export interface LiveFrame {
  W: number;
  H: number;
  B: number;
  tick: number;
  state: Uint8Array; // B*H*W
  oxygen: Uint8Array; // B*H*W
  focus: { x: number; y: number; attn: Float32Array } | null;
  version: number; // bumped each new frame so renderer knows to re-upload
}

export const liveFrame: LiveFrame = {
  W: 0,
  H: 0,
  B: 1,
  tick: 0,
  state: new Uint8Array(0),
  oxygen: new Uint8Array(0),
  focus: null,
  version: 0,
};

const MAX_HISTORY = 600;

interface StatsBuffer {
  // per-batch ring buffers of tumor_fraction
  series: number[][];
  necrotic: number[][];
  infected: number[][];
  push: (tumor: number[], necrotic: number[]) => void;
}

interface Store {
  connected: boolean;
  device: string;
  grid: number;
  params: Params;
  playing: boolean;
  split: boolean;
  scene: Scene;
  focusCell: { x: number; y: number } | null;
  sweep: SweepResult | null;
  sweepRunning: boolean;
  stats: StatsBuffer;
  lastTumorFraction: number[];

  setConnected: (v: boolean) => void;
  setHello: (grid: number, device: string, params: Params, playing: boolean) => void;
  setParam: (k: keyof Params, v: number) => void;
  setParams: (p: Partial<Params>) => void;
  setPlaying: (v: boolean) => void;
  setSplit: (v: boolean) => void;
  setScene: (s: Scene) => void;
  setFocusCell: (c: { x: number; y: number } | null) => void;
  setSweep: (s: SweepResult | null) => void;
  setSweepRunning: (v: boolean) => void;
  pushStats: (tumor: number[], necrotic: number[], infected?: number[]) => void;
}

const DEFAULT_PARAMS: Params = {
  aggression: 0.48,
  immune: 0.18,
  mutation: 0.0008,
  o_source: 0.042,
  speed: 30,
  infectivity: 0.28,
  latent_period: 6,
};

export const useStore = create<Store>((set, get) => ({
  connected: false,
  device: "?",
  grid: 128,
  params: DEFAULT_PARAMS,
  playing: true,
  split: false,
  scene: "tissue",
  focusCell: null,
  sweep: null,
  sweepRunning: false,
  lastTumorFraction: [0],
  stats: {
    series: [[]],
    necrotic: [[]],
    infected: [[]],
    push() {},
  },

  setConnected: (v) => set({ connected: v }),
  setHello: (grid, device, params, playing) =>
    set({ grid, device, params: { ...DEFAULT_PARAMS, ...params }, playing }),
  setParam: (k, v) => set((s) => ({ params: { ...s.params, [k]: v } })),
  setParams: (p) => set((s) => ({ params: { ...s.params, ...p } })),
  setPlaying: (v) => set({ playing: v }),
  setSplit: (v) => set({ split: v }),
  setScene: (s) => set({ scene: s }),
  setFocusCell: (c) => set({ focusCell: c }),
  setSweep: (s) => set({ sweep: s }),
  setSweepRunning: (v) => set({ sweepRunning: v }),
  pushStats: (tumor, necrotic, infected) => {
    const st = get().stats;
    const series = st.series.slice();
    const nec = st.necrotic.slice();
    const inf = st.infected.slice();
    for (let b = 0; b < tumor.length; b++) {
      if (!series[b]) series[b] = [];
      if (!nec[b]) nec[b] = [];
      if (!inf[b]) inf[b] = [];
      series[b] = series[b].concat(tumor[b]).slice(-MAX_HISTORY);
      nec[b] = nec[b].concat(necrotic[b]).slice(-MAX_HISTORY);
      inf[b] = inf[b].concat(infected ? infected[b] : 0).slice(-MAX_HISTORY);
    }
    // trim batches if fewer now
    series.length = tumor.length;
    nec.length = necrotic.length;
    inf.length = tumor.length;
    set({
      stats: { series, necrotic: nec, infected: inf, push() {} },
      lastTumorFraction: tumor,
    });
  },
}));
