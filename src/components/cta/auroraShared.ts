import { Color, Mesh, Program, Renderer, Triangle } from "ogl";

/**
 * One WebGL context per unique aurora look.
 *
 * CtaButton used to create a fresh OGL renderer per instance. A Ready-to-Reveal
 * shelf (or any list of CTAs) then blows past the browser's ~8–16 context cap
 * and Chrome starts killing the oldest ones:
 *   "Too many active WebGL contexts. Oldest context will be lost."
 *
 * Subscribers share a single offscreen WebGL canvas and blit into their own
 * 2D canvases, so the shader look stays live without one context per button.
 */

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[4];
uniform vec2 uResolution;
uniform float uBlend;
uniform float uBandHeight;
uniform float uRotation;
uniform float uParticleCount;
uniform float uParticleSize;
uniform float uParticleSpeed;
uniform float uParticleOpacity;
uniform vec3 uParticleColor;
uniform float uParticleTwinkle;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ),
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

vec2 hash12(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \\
  int index = 0;                                            \\
  for (int i = 0; i < 3; i++) {                               \\
     ColorStop currentColor = colors[i];                    \\
     bool isInBetween = currentColor.position <= factor;    \\
     index = int(mix(float(index), float(i), float(isInBetween))); \\
  }                                                         \\
  ColorStop currentColor = colors[index];                   \\
  ColorStop nextColor = colors[index + 1];                  \\
  float range = nextColor.position - currentColor.position; \\
  float lerpFactor = (factor - currentColor.position) / range; \\
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \\
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = max(uResolution.x, 1.0) / max(uResolution.y, 1.0);

  float rad = uRotation * 0.017453292519943295;
  float c = cos(rad);
  float s = sin(rad);
  vec2 fromCenter = uv - vec2(0.5);
  fromCenter.x *= aspect;
  vec2 rotated = vec2(
    fromCenter.x * c - fromCenter.y * s,
    fromCenter.x * s + fromCenter.y * c
  );
  rotated.x /= aspect;
  vec2 ruv = rotated + vec2(0.5);

  ColorStop colors[4];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.333333);
  colors[2] = ColorStop(uColorStops[2], 0.666667);
  colors[3] = ColorStop(uColorStops[3], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colors, ruv.x, rampColor);

  float cover = max(uBandHeight, 0.05);
  float y = 1.0 - (1.0 - ruv.y) / cover;
  y = clamp(y, 0.0, 2.5);

  float height = snoise(vec2(ruv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);

  vec3 auroraColor = intensity * rampColor;
  vec4 color = vec4(auroraColor * auroraAlpha, auroraAlpha);

  vec2 puv = vec2(ruv.x * aspect, ruv.y);
  float count = clamp(uParticleCount, 0.0, 24.0);
  float baseR = max(uParticleSize, 0.0005);
  float spd = uParticleSpeed;
  float opac = clamp(uParticleOpacity, 0.0, 1.0);

  for (int i = 0; i < 24; i++) {
    if (float(i) >= count) break;

    float fi = float(i);
    vec2 seed = hash12(fi + 1.7);
    float phase = hash11(fi + 9.1) * 6.2831853;
    float speedMul = 0.55 + hash11(fi + 3.3) * 0.9;
    float sizeMul = 0.55 + hash11(fi + 5.7) * 1.1;

    vec2 drift = vec2(
      sin(uTime * 0.55 * spd * speedMul + phase) * 0.18
        + cos(uTime * 0.21 * spd + phase * 1.7) * 0.06,
      fract(seed.y + uTime * 0.08 * spd * speedMul) * 1.15 - 0.08
    );

    vec2 center = vec2(seed.x * aspect, 0.0) + drift;
    center.x = clamp(center.x, 0.02 * aspect, aspect - 0.02 * aspect);

    float r = baseR * sizeMul * (0.85 + 0.15 * sin(uTime * 1.3 * spd + phase));
    float d = length(puv - center);
    float soft = smoothstep(r, r * 0.22, d);

    float twinkle = 1.0;
    if (uParticleTwinkle > 0.001) {
      float tw = 0.5 + 0.5 * sin(uTime * (2.0 + hash11(fi + 11.0) * 3.5) * spd + phase);
      twinkle = mix(1.0, tw, clamp(uParticleTwinkle, 0.0, 1.0));
    }

    float a = soft * opac * twinkle;
    color.rgb += uParticleColor * a;
    color.a = max(color.a, a);
  }

  fragColor = color;
}
`;

export type AuroraColorStops = [string, string, string, string];

export type AuroraVisualConfig = {
  colorStops: AuroraColorStops;
  amplitude: number;
  blend: number;
  speed: number;
  bandHeight: number;
  rotation: number;
  particleCount: number;
  particleSize: number;
  particleSpeed: number;
  particleOpacity: number;
  particleColor: string;
  particleTwinkle: number;
};

export type AuroraSubscription = {
  setSleeping: (sleeping: boolean) => void;
  setSize: (cssWidth: number, cssHeight: number) => void;
  renderOnce: () => void;
  destroy: () => void;
};

/** Leave headroom for Three.js pack stages and the scratch GL path. */
const MAX_AURORA_LAYERS = 4;

const layers = new Map<string, SharedAuroraLayer>();
let loopId = 0;

function hexToRgb(hex: string): [number, number, number] {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
}

export function auroraConfigKey(config: AuroraVisualConfig): string {
  return [
    config.colorStops.join("|"),
    config.amplitude,
    config.blend,
    config.speed,
    config.bandHeight,
    config.rotation,
    config.particleCount,
    config.particleSize,
    config.particleSpeed,
    config.particleOpacity,
    config.particleColor,
    config.particleTwinkle,
  ].join(":");
}

function parkCanvas(canvas: HTMLCanvasElement) {
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
}

function bufferSize(cssWidth: number, cssHeight: number) {
  const dpr = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2);
  return {
    width: Math.max(1, Math.min(640, Math.round(Math.max(cssWidth, 1) * dpr))),
    height: Math.max(1, Math.min(256, Math.round(Math.max(cssHeight, 1) * dpr))),
  };
}

function startLoop() {
  if (loopId) return;
  const tick = (now: number) => {
    let live = false;
    for (const layer of layers.values()) {
      if (layer.tick(now)) live = true;
    }
    loopId = live ? requestAnimationFrame(tick) : 0;
  };
  loopId = requestAnimationFrame(tick);
}

type Subscriber = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  bufferW: number;
  bufferH: number;
  sleeping: boolean;
};

class SharedAuroraLayer {
  readonly key: string;
  private readonly config: AuroraVisualConfig;
  private readonly renderer: Renderer;
  private readonly program: Program;
  private readonly mesh: Mesh;
  private readonly subscribers = new Set<Subscriber>();
  private timeOriginMs = performance.now();
  private width = 1;
  private height = 1;
  private lost = false;

  private constructor(
    key: string,
    config: AuroraVisualConfig,
    renderer: Renderer,
    program: Program,
    mesh: Mesh,
  ) {
    this.key = key;
    this.config = config;
    this.renderer = renderer;
    this.program = program;
    this.mesh = mesh;
    renderer.gl.canvas.addEventListener("webglcontextlost", this.onContextLost, false);
  }

  static tryCreate(key: string, config: AuroraVisualConfig): SharedAuroraLayer | null {
    let renderer: Renderer | null = null;
    try {
      renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        // Needed so 2D canvases can blit this frame after present.
        preserveDrawingBuffer: true,
        dpr: 1,
        powerPreference: "low-power",
      });
      const gl = renderer.gl;
      if (!gl) return null;

      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      parkCanvas(gl.canvas);

      const geometry = new Triangle(gl);
      if (geometry.attributes.uv) {
        delete geometry.attributes.uv;
      }

      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uAmplitude: { value: config.amplitude },
          uColorStops: { value: config.colorStops.map(hexToRgb) },
          uResolution: { value: [1, 1] },
          uBlend: { value: config.blend },
          uBandHeight: { value: config.bandHeight },
          uRotation: { value: config.rotation },
          uParticleCount: { value: config.particleCount },
          uParticleSize: { value: config.particleSize },
          uParticleSpeed: { value: config.particleSpeed },
          uParticleOpacity: { value: config.particleOpacity },
          uParticleColor: { value: hexToRgb(config.particleColor) },
          uParticleTwinkle: { value: config.particleTwinkle },
        },
      });
      const mesh = new Mesh(gl, { geometry, program });
      document.body.appendChild(gl.canvas);
      return new SharedAuroraLayer(key, config, renderer, program, mesh);
    } catch {
      const gl = renderer?.gl;
      if (gl?.canvas.parentNode) gl.canvas.remove();
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      return null;
    }
  }

  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.lost = true;
    this.dispose(false);
  };

  attach(canvas: HTMLCanvasElement): AuroraSubscription | null {
    if (this.lost) return null;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return null;

    const subscriber: Subscriber = {
      canvas,
      ctx,
      bufferW: Math.max(1, canvas.width || 1),
      bufferH: Math.max(1, canvas.height || 1),
      sleeping: false,
    };
    this.subscribers.add(subscriber);
    this.syncSharedSize();
    startLoop();

    return {
      setSleeping: (sleeping) => {
        subscriber.sleeping = sleeping;
        if (!sleeping) startLoop();
      },
      setSize: (cssWidth, cssHeight) => {
        const next = bufferSize(cssWidth, cssHeight);
        if (subscriber.bufferW === next.width && subscriber.bufferH === next.height) {
          return;
        }
        subscriber.bufferW = next.width;
        subscriber.bufferH = next.height;
        this.syncSharedSize();
        if (!subscriber.sleeping) startLoop();
      },
      renderOnce: () => {
        this.tick(performance.now(), true);
      },
      destroy: () => {
        this.subscribers.delete(subscriber);
        if (this.subscribers.size === 0) this.dispose(true);
      },
    };
  }

  private syncSharedSize() {
    let width = 1;
    let height = 1;
    for (const subscriber of this.subscribers) {
      width = Math.max(width, subscriber.bufferW);
      height = Math.max(height, subscriber.bufferH);
    }
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height);
    this.program.uniforms.uResolution.value = [width, height];
    parkCanvas(this.renderer.gl.canvas);
  }

  tick(nowMs: number, force = false): boolean {
    if (this.lost) return false;
    let awake = 0;
    for (const subscriber of this.subscribers) {
      if (!subscriber.sleeping) awake += 1;
    }
    if (!force && awake === 0) return false;

    const elapsedSec = (nowMs - this.timeOriginMs) / 1000;
    const uniforms = this.program.uniforms;
    uniforms.uTime.value = elapsedSec * this.config.speed;
    uniforms.uAmplitude.value = this.config.amplitude;
    uniforms.uBlend.value = this.config.blend;
    uniforms.uBandHeight.value = this.config.bandHeight;
    uniforms.uRotation.value = this.config.rotation;
    uniforms.uParticleCount.value = this.config.particleCount;
    uniforms.uParticleSize.value = this.config.particleSize;
    uniforms.uParticleSpeed.value = this.config.particleSpeed;
    uniforms.uParticleOpacity.value = this.config.particleOpacity;
    uniforms.uParticleTwinkle.value = this.config.particleTwinkle;
    this.renderer.render({ scene: this.mesh });

    const source = this.renderer.gl.canvas;
    for (const subscriber of this.subscribers) {
      if (!force && subscriber.sleeping) continue;
      if (
        subscriber.canvas.width !== subscriber.bufferW ||
        subscriber.canvas.height !== subscriber.bufferH
      ) {
        subscriber.canvas.width = subscriber.bufferW;
        subscriber.canvas.height = subscriber.bufferH;
      }
      subscriber.ctx.clearRect(0, 0, subscriber.bufferW, subscriber.bufferH);
      subscriber.ctx.drawImage(source, 0, 0, subscriber.bufferW, subscriber.bufferH);
    }
    return awake > 0;
  }

  private dispose(loseContext: boolean) {
    layers.delete(this.key);
    const gl = this.renderer.gl;
    gl.canvas.removeEventListener("webglcontextlost", this.onContextLost, false);
    if (gl.canvas.parentNode) gl.canvas.remove();
    if (loseContext && !this.lost) {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.lost = true;
    this.subscribers.clear();
  }
}

export function subscribeAurora(
  config: AuroraVisualConfig,
  canvas: HTMLCanvasElement,
): AuroraSubscription | null {
  if (typeof document === "undefined") return null;

  const key = auroraConfigKey(config);
  let layer = layers.get(key);
  if (!layer) {
    if (layers.size >= MAX_AURORA_LAYERS) return null;
    const created = SharedAuroraLayer.tryCreate(key, config);
    if (!created) return null;
    layers.set(key, created);
    layer = created;
  }

  return layer.attach(canvas);
}
