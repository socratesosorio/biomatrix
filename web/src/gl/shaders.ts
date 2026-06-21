export const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;   // full-screen quad in clip space [-1,1]
out vec2 vUV;                       // 0..1 screen UV
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// Tissue = full-screen quad sampling a state texture (R8UI) + oxygen texture.
// Camera = uCenter / uCoverage windowing the grid UVs. Zoom = shrink coverage.
export const FRAG = `#version 300 es
precision highp float;
precision highp usampler2D;

in vec2 vUV;
out vec4 frag;

uniform usampler2D uStateTex;  // W x (H*B), integer 0..3
uniform sampler2D  uOxyTex;    // W x (H*B), R8 normalized
uniform vec2  uGrid;           // (W, H)
uniform int   uBatches;        // B
uniform vec2  uCenter;         // tissue-space center in [0,1]
uniform float uCoverage;       // fraction of grid visible (1 = whole grid)
uniform vec2  uAspect;         // aspect correction for coverage
uniform float uTime;
uniform float uCellShape;      // 0 (flat) .. 1 (gooey discs) — grows with zoom
uniform int   uSplit;          // 1 = two batches side by side
uniform vec2  uFocus;          // focused cell (col,row) or (-1,-1)
uniform float uVignette;

// palette
const vec3 C_EMPTY   = vec3(0.03, 0.04, 0.06);
const vec3 C_HEALTHY = vec3(0.16, 0.52, 0.55);
const vec3 C_HEALTHY2= vec3(0.42, 0.30, 0.42);
const vec3 C_TUMOR   = vec3(0.95, 0.10, 0.45);
const vec3 C_TUMOR2  = vec3(1.00, 0.45, 0.10);
const vec3 C_NECRO   = vec3(0.18, 0.12, 0.08);
const vec3 C_EXPOSED = vec3(0.92, 0.88, 0.45);   // pale yellow
const vec3 C_INFECT  = vec3(1.00, 0.50, 0.05);   // bright orange
const vec3 C_VDEAD   = vec3(0.40, 0.40, 0.42);   // grey

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  // split-screen: remap x into one of two batches
  vec2 suv = vUV;
  int batch = 0;
  float gap = 0.0;
  if (uSplit == 1 && uBatches >= 2) {
    if (suv.x < 0.5) { batch = 0; suv.x = suv.x * 2.0; }
    else { batch = 1; suv.x = (suv.x - 0.5) * 2.0; }
    gap = smoothstep(0.0, 0.012, abs(vUV.x - 0.5));
  }

  // screen UV -> grid UV via camera
  vec2 gridUV = uCenter + (suv - 0.5) * uCoverage * uAspect;

  if (gridUV.x < 0.0 || gridUV.x > 1.0 || gridUV.y < 0.0 || gridUV.y > 1.0) {
    frag = vec4(0.01, 0.012, 0.02, 1.0);
    return;
  }

  vec2 cellCoord = gridUV * uGrid;
  ivec2 cell = ivec2(floor(cellCoord));
  vec2 local = fract(cellCoord);

  int H = int(uGrid.y);
  ivec2 texel = ivec2(cell.x, cell.y + batch * H);
  uint s = texelFetch(uStateTex, texel, 0).r;
  float ox = texelFetch(uOxyTex, texel, 0).r;

  // base color by state
  vec3 col;
  float jitter = hash(vec2(cell) + 0.5);
  if (s == 0u) {
    col = C_EMPTY;
  } else if (s == 1u) {
    col = mix(C_HEALTHY, C_HEALTHY2, jitter * 0.6);
  } else if (s == 2u) {
    col = mix(C_TUMOR, C_TUMOR2, 0.3 + 0.5 * jitter);
  } else if (s == 3u) {
    col = C_NECRO * (0.7 + 0.5 * jitter);
  } else if (s == 4u) {
    col = mix(C_EXPOSED, C_HEALTHY, 0.45);        // EXPOSED: faintly yellow tissue
  } else if (s == 5u) {
    col = mix(C_INFECT, vec3(1.0, 0.8, 0.2), 0.3 * jitter);  // INFECTIOUS
  } else {
    col = C_VDEAD * (0.8 + 0.4 * jitter);         // VIRAL_DEAD
  }

  // oxygen underlay: low O reads as darker / bruised
  float oxShade = mix(0.55, 1.08, ox);
  col *= oxShade;
  // hypoxic bruise tint
  col = mix(col, col * vec3(0.55, 0.6, 0.85), (1.0 - ox) * 0.35);

  // ---- cell shaping (the "alive" look) ----
  if (s != 0u) {
    // organic per-cell disc with jittered center + radius
    vec2 c = vec2(0.5) + (vec2(hash(vec2(cell) + 7.0), hash(vec2(cell) + 13.0)) - 0.5) * 0.18;
    float r = 0.46 + 0.06 * sin(uTime * 1.5 + jitter * 6.28);
    float d = distance(local, c);
    float disc = 1.0 - smoothstep(r - 0.18, r, d);
    // membrane: darken inter-cell gap
    float membrane = mix(1.0, disc, uCellShape);
    col *= mix(1.0, 0.25 + 0.75 * disc, uCellShape);
    // soft nucleus glow for tumor/healthy
    float nucleus = 1.0 - smoothstep(0.0, 0.22, d);
    col += col * nucleus * uCellShape * 0.5;
    // gentle inner highlight
    col += vec3(0.04) * disc * uCellShape;
  } else {
    // empty: subtle plasma texture so gaps aren't dead-flat
    float n = hash(vec2(cell) + floor(uTime));
    col += vec3(0.01, 0.015, 0.02) * n;
  }

  // focus ring on the inspected cell
  if (uFocus.x >= 0.0) {
    if (cell.x == int(uFocus.x) && cell.y == int(uFocus.y)) {
      float ring = smoothstep(0.34, 0.30, distance(local, vec2(0.5)));
      col = mix(col, vec3(1.0, 0.95, 0.4), ring * 0.8);
    }
  }

  // split divider: thin dark seam down the middle
  if (uSplit == 1) col *= gap;

  // vignette
  float v = distance(vUV, vec2(0.5));
  col *= mix(1.0, 0.72, smoothstep(0.4, 0.95, v) * uVignette);

  frag = vec4(col, 1.0);
}
`;
