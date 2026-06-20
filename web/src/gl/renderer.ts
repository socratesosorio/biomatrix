import { VERT, FRAG } from "./shaders";
import { liveFrame } from "../state";

export interface Camera {
  centerX: number; // tissue UV center
  centerY: number;
  coverage: number; // fraction of grid visible (1 = whole grid, smaller = zoom in)
  cellShape: number; // 0..1 disc-ness
  vignette: number;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error("shader compile: " + gl.getShaderInfoLog(sh));
  }
  return sh;
}

export class Renderer {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  stateTex: WebGLTexture;
  oxyTex: WebGLTexture;
  uniforms: Record<string, WebGLUniformLocation | null> = {};
  lastVersion = -1;
  texW = 0;
  texH = 0;
  startTime = performance.now();

  // camera (mutated externally by Stage animation)
  cam: Camera = { centerX: 0.5, centerY: 0.5, coverage: 1.0, cellShape: 0.0, vignette: 1.0 };
  split = false;
  focus: { x: number; y: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: false });
    if (!gl) throw new Error("WebGL2 not supported");
    this.gl = gl;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error("link: " + gl.getProgramInfoLog(prog));
    }
    this.prog = prog;

    // full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]), // big triangle
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.stateTex = gl.createTexture()!;
    this.oxyTex = gl.createTexture()!;

    for (const name of [
      "uStateTex", "uOxyTex", "uGrid", "uBatches", "uCenter", "uCoverage",
      "uAspect", "uTime", "uCellShape", "uSplit", "uFocus", "uVignette",
    ]) {
      this.uniforms[name] = gl.getUniformLocation(prog, name);
    }
    gl.useProgram(prog);
    gl.uniform1i(this.uniforms.uStateTex, 0);
    gl.uniform1i(this.uniforms.uOxyTex, 1);
  }

  private allocTextures(W: number, H: number, B: number) {
    const gl = this.gl;
    const th = H * B;
    gl.bindTexture(gl.TEXTURE_2D, this.stateTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, W, th, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, null);

    gl.bindTexture(gl.TEXTURE_2D, this.oxyTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, W, th, 0, gl.RED, gl.UNSIGNED_BYTE, null);

    this.texW = W;
    this.texH = th;
  }

  private upload() {
    const gl = this.gl;
    const { W, H, B, state, oxygen } = liveFrame;
    if (W === 0) return false;
    if (this.texW !== W || this.texH !== H * B) {
      this.allocTextures(W, H, B);
    }
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, this.stateTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H * B, gl.RED_INTEGER, gl.UNSIGNED_BYTE, state);
    gl.bindTexture(gl.TEXTURE_2D, this.oxyTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H * B, gl.RED, gl.UNSIGNED_BYTE, oxygen);
    return true;
  }

  render(canvasW: number, canvasH: number) {
    const gl = this.gl;
    if (liveFrame.version !== this.lastVersion) {
      if (!this.upload()) return;
      this.lastVersion = liveFrame.version;
    }
    if (this.texW === 0) return;

    gl.viewport(0, 0, canvasW, canvasH);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.stateTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.oxyTex);

    const aspect = canvasW / canvasH;
    // keep cells square: coverage applies to the larger axis
    let ax = 1.0, ay = 1.0;
    if (aspect >= 1.0) ax = aspect; else ay = 1.0 / aspect;

    gl.uniform2f(this.uniforms.uGrid, liveFrame.W, liveFrame.H);
    gl.uniform1i(this.uniforms.uBatches, liveFrame.B);
    gl.uniform2f(this.uniforms.uCenter, this.cam.centerX, this.cam.centerY);
    gl.uniform1f(this.uniforms.uCoverage, this.cam.coverage);
    gl.uniform2f(this.uniforms.uAspect, ax, ay);
    gl.uniform1f(this.uniforms.uTime, (performance.now() - this.startTime) / 1000);
    gl.uniform1f(this.uniforms.uCellShape, this.cam.cellShape);
    gl.uniform1f(this.uniforms.uVignette, this.cam.vignette);
    gl.uniform1i(this.uniforms.uSplit, this.split && liveFrame.B >= 2 ? 1 : 0);
    if (this.focus) gl.uniform2f(this.uniforms.uFocus, this.focus.x, this.focus.y);
    else gl.uniform2f(this.uniforms.uFocus, -1, -1);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
