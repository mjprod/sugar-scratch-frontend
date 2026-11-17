import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CanvasTexture,
  DoubleSide,
  PerspectiveCamera,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
  type Group,
  type MeshBasicMaterial,
  type MeshPhysicalMaterial,
} from "three";
import {
  JOKER_COUNT,
  JOKER_MAX,
  JOKER_MIN,
  RAD_PER_SLOT,
  type JokerBallHandle,
  fingerVelocity,
  flingIndex,
  motionBlurPx,
  padJoker,
} from "@/pages/jokerBall";
import {
  DEFAULT_JOKER_LOOK,
  type JokerBallLook,
} from "@/pages/jokerBallLook";
import {
  DROP_START_Y,
  dropLandStrength,
  stepBallDrop,
} from "@/pages/jokerBallDrop";
import {
  DEFAULT_JOKER_GRADIENT,
  DEFAULT_JOKER_WINDOW,
  windowGradientCss,
  windowShadowCss,
} from "@/pages/jokerBallWindow";

const NUMBERS = Array.from(
  { length: JOKER_COUNT },
  (_, i) => i + JOKER_MIN,
);

type Props = {
  initialIndex: number;
  onIndexChange: (index: number) => void;
  /** Fires once the post-land swipe hint reaches its peek (or is skipped). */
  onSwipeHintPeak?: () => void;
};

/** Wood-like streaks that keep the mean color near #A89C87. */
function woodTextures() {
  const size = 512;
  const colorCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  colorCanvas.width = bumpCanvas.width = size;
  colorCanvas.height = bumpCanvas.height = size;
  const colorCtx = colorCanvas.getContext("2d");
  const bumpCtx = bumpCanvas.getContext("2d");
  if (!colorCtx || !bumpCtx) {
    return {
      color: new CanvasTexture(colorCanvas),
      bump: new CanvasTexture(bumpCanvas),
      colorFull: new ImageData(size, size),
      bumpFull: new ImageData(size, size),
      colorCtx,
      bumpCtx,
    };
  }

  const base = { r: 0xa8, g: 0x9c, b: 0x87 };
  const colorFull = colorCtx.createImageData(size, size);
  const bumpFull = bumpCtx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Flowing wood rings/streaks along X with a little warp.
      const warp =
        Math.sin(y * 0.035) * 18 +
        Math.sin(y * 0.09 + 1.7) * 8 +
        Math.sin((x + y) * 0.02) * 6;
      const grain =
        Math.sin((x + warp) * 0.11) * 0.55 +
        Math.sin((x + warp * 0.6) * 0.31) * 0.28 +
        Math.sin((x * 0.7 + y * 0.15) * 0.55) * 0.12;
      const pore = (Math.random() - 0.5) * 0.18;
      const tone = grain * 0.5 + pore;
      const shade = 1 + tone * 0.16;
      colorFull.data[i] = Math.max(0, Math.min(255, Math.round(base.r * shade)));
      colorFull.data[i + 1] = Math.max(
        0,
        Math.min(255, Math.round(base.g * shade)),
      );
      colorFull.data[i + 2] = Math.max(
        0,
        Math.min(255, Math.round(base.b * shade)),
      );
      colorFull.data[i + 3] = 255;
      const b = Math.max(0, Math.min(255, Math.round(128 + tone * 90)));
      bumpFull.data[i] = b;
      bumpFull.data[i + 1] = b;
      bumpFull.data[i + 2] = b;
      bumpFull.data[i + 3] = 255;
    }
  }

  const colorMap = new CanvasTexture(colorCanvas);
  colorMap.colorSpace = SRGBColorSpace;
  colorMap.wrapS = colorMap.wrapT = RepeatWrapping;
  const bumpMap = new CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = RepeatWrapping;
  return {
    color: colorMap,
    bump: bumpMap,
    colorFull,
    bumpFull,
    colorCtx,
    bumpCtx,
  };
}

function paintGrainOpacity(
  maps: ReturnType<typeof woodTextures>,
  opacity: number,
) {
  const { colorCtx, bumpCtx, colorFull, bumpFull, color, bump } = maps;
  if (!colorCtx || !bumpCtx) return;
  const t = Math.max(0, Math.min(1, opacity));
  const base = { r: 0xa8, g: 0x9c, b: 0x87 };
  const colorOut = colorCtx.createImageData(colorFull.width, colorFull.height);
  const bumpOut = bumpCtx.createImageData(bumpFull.width, bumpFull.height);
  for (let i = 0; i < colorFull.data.length; i += 4) {
    colorOut.data[i] = Math.round(base.r + (colorFull.data[i] - base.r) * t);
    colorOut.data[i + 1] = Math.round(
      base.g + (colorFull.data[i + 1] - base.g) * t,
    );
    colorOut.data[i + 2] = Math.round(
      base.b + (colorFull.data[i + 2] - base.b) * t,
    );
    colorOut.data[i + 3] = 255;
    bumpOut.data[i] = Math.round(128 + (bumpFull.data[i] - 128) * t);
    bumpOut.data[i + 1] = bumpOut.data[i];
    bumpOut.data[i + 2] = bumpOut.data[i];
    bumpOut.data[i + 3] = 255;
  }
  colorCtx.putImageData(colorOut, 0, 0);
  bumpCtx.putImageData(bumpOut, 0, 0);
  color.needsUpdate = true;
  bump.needsUpdate = true;
}

function SpinningShell({
  progressRef,
  look,
}: {
  progressRef: React.MutableRefObject<number>;
  look: JokerBallLook;
}) {
  const group = useRef<Group>(null);
  const material = useRef<MeshPhysicalMaterial>(null);
  const maps = useMemo(() => {
    const next = woodTextures();
    paintGrainOpacity(next, 1);
    return next;
  }, []);
  useFrame(() => {
    if (!group.current) return;
    // Spin opposite the number strip: ball right → numbers left.
    group.current.rotation.y = progressRef.current * RAD_PER_SLOT;
  });
  useEffect(() => {
    maps.color.repeat.set(look.grainRepeat, look.grainRepeat * 0.55);
    maps.bump.repeat.set(look.grainRepeat, look.grainRepeat * 0.55);
    maps.color.needsUpdate = true;
    maps.bump.needsUpdate = true;
  }, [look.grainRepeat, maps]);
  useEffect(() => {
    paintGrainOpacity(maps, look.grainOpacity);
  }, [look.grainOpacity, maps]);
  useEffect(
    () => () => {
      maps.color.dispose();
      maps.bump.dispose();
    },
    [maps],
  );
  useEffect(() => {
    const mat = material.current;
    if (!mat) return;
    mat.roughness = look.roughness;
    mat.metalness = look.metalness;
    mat.clearcoat = look.clearcoat;
    mat.clearcoatRoughness = look.clearcoatRoughness;
    mat.bumpScale = look.bumpScale * look.grainOpacity;
    mat.needsUpdate = true;
  }, [look]);
  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[1, 96, 96]} />
        <meshPhysicalMaterial
          ref={material}
          map={maps.color}
          color="#ffffff"
          roughness={look.roughness}
          metalness={look.metalness}
          clearcoat={look.clearcoat}
          clearcoatRoughness={look.clearcoatRoughness}
          bumpMap={maps.bump}
          bumpScale={look.bumpScale}
          roughnessMap={maps.bump}
        />
      </mesh>
    </group>
  );
}

/** Shell sits slightly above origin so the ground shadow has room. */
const BALL_CENTER_Y = 0.15;
const BASE_FOV = 36;

/**
 * Aim + FOV for a canvas that stretches from the page top down to the ball.
 * Rest pose stays locked to the HTML window; sky above is free for the drop.
 *
 * Uses camera.manual so R3F won't overwrite the projection / viewOffset.
 */
function LookCamera({
  ballEl,
}: {
  ballEl: React.RefObject<HTMLDivElement | null>;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);

  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera & { manual?: boolean };
    cam.manual = true;
    return () => {
      cam.manual = false;
      cam.clearViewOffset();
    };
  }, [camera]);

  useFrame(() => {
    const ball = ballEl.current;
    const cam = camera as PerspectiveCamera;
    if (!ball) return;

    const canvasRect =
      gl.domElement.parentElement?.getBoundingClientRect() ??
      gl.domElement.getBoundingClientRect();
    const ballRect = ball.getBoundingClientRect();
    const canvasW = Math.max(1, canvasRect.width);
    const canvasH = Math.max(1, canvasRect.height);
    // Original short frame the look was tuned for (= ball layout box).
    const baseH = Math.max(1, ballRect.height);
    const sky = Math.max(0, canvasH - baseH);

    cam.position.set(
      DEFAULT_JOKER_LOOK.camX,
      DEFAULT_JOKER_LOOK.camY,
      DEFAULT_JOKER_LOOK.camZ,
    );
    cam.lookAt(0, BALL_CENTER_Y, 0);

    // Keep the base FOV/aspect, then extend the film upward so extra sky
    // appears above while the rest pose stays glued to the ball box.
    cam.fov = BASE_FOV;
    cam.aspect = canvasW / baseH;
    cam.setViewOffset(canvasW, baseH, 0, -sky, canvasW, canvasH);
    cam.updateProjectionMatrix();
  });

  return null;
}

/** Soft elliptical blob under the ball — reliable inside the stage (no depth pass). */
function GroundShadow({
  opacity,
  scale,
  strengthRef,
}: {
  opacity: number;
  scale: number;
  /** 0–1 land proximity; fades the blob in as the ball drops. */
  strengthRef: React.MutableRefObject<number>;
}) {
  const mats = useRef<{ mat: MeshBasicMaterial; base: number }[]>([]);
  const map = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(0,0,0,0.7)");
    gradient.addColorStop(0.4, "rgba(0,0,0,0.28)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(
    () => () => {
      map?.dispose();
    },
    [map],
  );
  useFrame(() => {
    const strength = strengthRef.current;
    for (const entry of mats.current) {
      entry.mat.opacity = entry.base * strength;
    }
  });
  if (!map || opacity <= 0) return null;
  // Alpha caps at 1 — stack layers so intensity can go to ~3.
  const layers = [
    Math.min(1, opacity),
    Math.min(1, Math.max(0, opacity - 1)),
    Math.min(1, Math.max(0, opacity - 2)),
  ].filter((layer) => layer > 0);
  return (
    <group>
      {layers.map((layerOpacity, index) => (
        <mesh
          key={index}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.851 - index * 0.0005, 0]}
          scale={[scale * 0.42, scale * 0.28, 1]}
          renderOrder={-1}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            ref={(mat) => {
              if (!mat) return;
              const existing = mats.current.find((entry) => entry.mat === mat);
              if (existing) existing.base = layerOpacity;
              else mats.current.push({ mat, base: layerOpacity });
            }}
            map={map}
            color="#000000"
            transparent
            opacity={0}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Gravity drop + bounce into the resting pose; keeps the HTML window locked on. */
function FallingShell({
  progressRef,
  look,
  windowEl,
  onLanded,
}: {
  progressRef: React.MutableRefObject<number>;
  look: JokerBallLook;
  windowEl: React.RefObject<HTMLDivElement | null>;
  onLanded: () => void;
}) {
  const group = useRef<Group>(null);
  const yRef = useRef(DROP_START_Y);
  const vRef = useRef(0);
  const settled = useRef(false);
  const landRef = useRef(0);
  const landedFired = useRef(false);
  const restNdc = useRef(new Vector3());
  const curNdc = useRef(new Vector3());
  const { camera, size } = useThree();
  const onLandedRef = useRef(onLanded);
  onLandedRef.current = onLanded;
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useLayoutEffect(() => {
    yRef.current = reduceMotion ? BALL_CENTER_Y : DROP_START_Y;
    vRef.current = 0;
    settled.current = reduceMotion;
    landRef.current = reduceMotion ? 1 : 0;
    landedFired.current = reduceMotion;
    if (group.current) group.current.position.y = yRef.current;
    const el = windowEl.current;
    if (!el) return;
    if (reduceMotion) {
      el.style.transform = "";
      el.classList.add("is-live");
    } else {
      el.classList.remove("is-live");
      el.style.transform = "";
    }
  }, [reduceMotion, windowEl]);

  useFrame((_, rawDt) => {
    if (!settled.current) {
      const next = stepBallDrop(
        yRef.current,
        vRef.current,
        rawDt,
        BALL_CENTER_Y,
      );
      yRef.current = next.y;
      vRef.current = next.v;
      settled.current = next.settled;
      if (next.settled && !landedFired.current) {
        landedFired.current = true;
        onLandedRef.current();
      }
    }
    landRef.current = dropLandStrength(yRef.current, BALL_CENTER_Y);
    if (group.current) group.current.position.y = yRef.current;

    const el = windowEl.current;
    if (el) {
      // Project rest vs current ball centre — correct for perspective + cam offset.
      restNdc.current.set(0, BALL_CENTER_Y, 0).project(camera);
      curNdc.current.set(0, yRef.current, 0).project(camera);
      const dx = ((curNdc.current.x - restNdc.current.x) * size.width) / 2;
      const dy = (-(curNdc.current.y - restNdc.current.y) * size.height) / 2;
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      // Reveal only after the first projected frame so it never flashes at rest.
      el.classList.add("is-live");
    }
  });

  return (
    <>
      <group ref={group} position={[0, DROP_START_Y, 0]}>
        <SpinningShell progressRef={progressRef} look={look} />
      </group>
      <GroundShadow
        opacity={look.shadowOpacity}
        scale={look.shadowScale}
        strengthRef={landRef}
      />
    </>
  );
}

/** Three.js shell + carousel number strip in the front window. */
export const JokerBall3D = forwardRef<JokerBallHandle, Props>(
  function JokerBall3D({ initialIndex, onIndexChange, onSwipeHintPeak }, ref) {
    const progressRef = useRef(initialIndex);
    const indexRef = useRef(initialIndex);
    const slotPx = useRef(200);
    const frame = useRef(0);
    const peakFired = useRef(false);
    const onPeakRef = useRef(onSwipeHintPeak);
    onPeakRef.current = onSwipeHintPeak;
    const rootEl = useRef<HTMLDivElement>(null);
    const windowEl = useRef<HTMLDivElement>(null);
    const track = useRef<HTMLDivElement>(null);
    const [canvasStyle, setCanvasStyle] = useState<React.CSSProperties>({
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      zIndex: 0,
      pointerEvents: "none",
      overflow: "hidden",
    });
    const drag = useRef<{
      pointerId: number;
      x: number;
      progress: number;
      samples: { x: number; t: number }[];
    } | null>(null);
    const hintTimer = useRef(0);
    const [index, setIndex] = useState(initialIndex);
    const look = DEFAULT_JOKER_LOOK;
    const windowLook = DEFAULT_JOKER_WINDOW;
    const gradient = DEFAULT_JOKER_GRADIENT;
    const dpr = useMemo(
      () =>
        Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2),
      [],
    );

    const value = index + JOKER_MIN;

    function paintStrip(progress: number) {
      const strip = track.current;
      if (!strip) return;
      strip.style.transform = `translate3d(${-progress * slotPx.current}px, 0, 0)`;
    }

    function paintBlur(pxPerMs: number) {
      const strip = track.current;
      if (!strip) return;
      const px = motionBlurPx(pxPerMs);
      // CSS blur — much more visible on iOS than SVG feGaussianBlur.
      strip.style.filter = px > 0 ? `blur(${px}px)` : "";
    }

    function fireSwipeHintPeak() {
      if (peakFired.current) return;
      peakFired.current = true;
      onPeakRef.current?.();
    }

    function stopGlide(revealControls = false) {
      const interrupted = Boolean(hintTimer.current || frame.current);
      if (hintTimer.current) {
        window.clearTimeout(hintTimer.current);
        hintTimer.current = 0;
      }
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
      // Early swipe cancels the peek — still reveal dice + chevrons.
      if (revealControls && interrupted) fireSwipeHintPeak();
    }

    function publish(progress: number) {
      paintStrip(progress);
      const next = Math.max(0, Math.min(JOKER_COUNT - 1, Math.round(progress)));
      if (next === indexRef.current) return;
      indexRef.current = next;
      setIndex(next);
      onIndexChange(next);
    }

    /** After the drop: anticipation → peek halfway to the next number → settle. */
    function playSwipeHint() {
      if (drag.current || frame.current) {
        fireSwipeHintPeak();
        return;
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        fireSwipeHintPeak();
        return;
      }
      const rest = indexRef.current;
      const dir = rest >= JOKER_COUNT - 1 ? -1 : 1;
      const anti = rest - dir * 0.04;
      const peek = rest + dir * 0.22;
      const peekAt = 1100;
      const keys = [
        { at: 0, v: rest },
        { at: 480, v: rest }, // hold after settle before the hint moves
        { at: 640, v: anti },
        { at: peekAt, v: peek },
        { at: 1800, v: rest },
      ];
      const total = keys[keys.length - 1].at;
      const t0 = performance.now();
      // Soft ease-in-out (smoother than cubic-out).
      const ease = (t: number) =>
        t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      const step = (now: number) => {
        if (drag.current) {
          frame.current = 0;
          fireSwipeHintPeak();
          return;
        }
        const elapsed = now - t0;
        if (elapsed >= peekAt) fireSwipeHintPeak();
        let progress = rest;
        for (let i = 0; i < keys.length - 1; i++) {
          const a = keys[i];
          const b = keys[i + 1];
          if (elapsed <= b.at) {
            const u = ease(
              Math.max(0, Math.min(1, (elapsed - a.at) / (b.at - a.at))),
            );
            progress = a.v + (b.v - a.v) * u;
            break;
          }
          progress = b.v;
        }
        progressRef.current = progress;
        paintStrip(progress);
        if (elapsed < total) {
          frame.current = requestAnimationFrame(step);
          return;
        }
        frame.current = 0;
        progressRef.current = rest;
        paintStrip(rest);
        fireSwipeHintPeak();
      };
      frame.current = requestAnimationFrame(step);
    }

    function onBallLanded() {
      if (hintTimer.current) window.clearTimeout(hintTimer.current);
      // Beat after the last bounce so the hint reads clearly.
      hintTimer.current = window.setTimeout(() => {
        hintTimer.current = 0;
        playSwipeHint();
      }, 520);
    }

    function glideTo(next: number) {
      const clamped = Math.max(0, Math.min(JOKER_COUNT - 1, next));
      const start = progressRef.current;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      stopGlide();
      if (reduce || Math.abs(clamped - start) < 0.001) {
        progressRef.current = clamped;
        indexRef.current = clamped;
        setIndex(clamped);
        onIndexChange(clamped);
        paintStrip(clamped);
        paintBlur(0);
        return;
      }
      const distance = Math.abs(clamped - start);
      const duration = Math.min(
        1400,
        Math.max(320, 260 + distance * slotPx.current * 0.45),
      );
      const t0 = performance.now();
      let prev = start;
      let prevT = t0;
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        const eased = 1 - (1 - t) ** 3;
        const progress = start + (clamped - start) * eased;
        progressRef.current = progress;
        publish(progress);
        const dt = Math.max(now - prevT, 8);
        paintBlur((Math.abs(progress - prev) * slotPx.current) / dt);
        prev = progress;
        prevT = now;
        if (t < 1) {
          frame.current = requestAnimationFrame(step);
          return;
        }
        frame.current = 0;
        progressRef.current = clamped;
        indexRef.current = clamped;
        setIndex(clamped);
        onIndexChange(clamped);
        paintStrip(clamped);
        paintBlur(0);
      };
      frame.current = requestAnimationFrame(step);
    }

    useImperativeHandle(ref, () => ({ glideTo }), []);

    useEffect(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        fireSwipeHintPeak();
      }
    }, []);

    useLayoutEffect(() => {
      const el = windowEl.current;
      const strip = track.current;
      if (!el || !strip) return;
      let width = 0;
      const align = () => {
        const next = el.clientWidth;
        if (!next || next === width) return;
        width = next;
        slotPx.current = next;
        for (const child of strip.querySelectorAll<HTMLElement>(".joker-ball__num")) {
          child.style.flexBasis = `${next}px`;
        }
        if (!drag.current && !frame.current) {
          paintStrip(progressRef.current);
        }
      };
      align();
      const observer = new ResizeObserver(align);
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    // Stretch the WebGL layer from the page top down to the ball so the drop is visible.
    useLayoutEffect(() => {
      const root = rootEl.current;
      if (!root) return;
      const sync = () => {
        const ballRect = root.getBoundingClientRect();
        const page =
          (root.closest(".joker-ball-page") as HTMLElement | null) ??
          (root.closest(".app-layout__immersive") as HTMLElement | null);
        const pageTop = page?.getBoundingClientRect().top ?? 0;
        const sky = Math.max(0, ballRect.top - pageTop);
        setCanvasStyle({
          position: "absolute",
          top: -sky,
          left: 0,
          width: "100%",
          height: ballRect.bottom - pageTop,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        });
      };
      sync();
      const observer = new ResizeObserver(sync);
      observer.observe(root);
      const page = root.closest(".joker-ball-page");
      if (page) observer.observe(page);
      window.addEventListener("resize", sync);
      window.addEventListener("scroll", sync, true);
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", sync);
        window.removeEventListener("scroll", sync, true);
      };
    }, []);

    useEffect(() => () => stopGlide(), []);

    function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
      if (event.button !== 0) return;
      stopGlide(true);
      fireSwipeHintPeak();
      progressRef.current = indexRef.current;
      paintStrip(indexRef.current);
      paintBlur(0);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic pointers and already-released ones can't be captured.
      }
      drag.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        progress: progressRef.current,
        samples: [{ x: event.clientX, t: event.timeStamp }],
      };
      event.currentTarget.classList.add("is-dragging");
    }

    function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
      const active = drag.current;
      if (!active || active.pointerId !== event.pointerId) return;
      const deltaSlots = (event.clientX - active.x) / -slotPx.current;
      const progress = Math.max(
        0,
        Math.min(JOKER_COUNT - 1, active.progress + deltaSlots),
      );
      progressRef.current = progress;
      publish(progress);
      active.samples.push({ x: event.clientX, t: event.timeStamp });
      if (active.samples.length > 6) active.samples.shift();
    }

    function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
      const active = drag.current;
      if (!active || active.pointerId !== event.pointerId) return;
      drag.current = null;
      event.currentTarget.classList.remove("is-dragging");
      active.samples.push({ x: event.clientX, t: event.timeStamp });
      const span = slotPx.current;
      glideTo(
        flingIndex(
          progressRef.current * span,
          span,
          fingerVelocity(active.samples),
          JOKER_COUNT,
        ),
      );
    }

    function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        fireSwipeHintPeak();
        glideTo(indexRef.current + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        fireSwipeHintPeak();
        glideTo(indexRef.current - 1);
      }
    }

    return (
      <div
        ref={rootEl}
        className="joker-ball joker-ball--3d"
        tabIndex={0}
        role="slider"
        aria-label="Joker ball 3D"
        aria-valuemin={JOKER_MIN}
        aria-valuemax={JOKER_MAX}
        aria-valuenow={value}
        aria-valuetext={padJoker(value)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <Canvas
          className="joker-ball-3d__canvas"
          style={canvasStyle}
          dpr={dpr}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
          camera={{
            position: [
              DEFAULT_JOKER_LOOK.camX,
              DEFAULT_JOKER_LOOK.camY,
              DEFAULT_JOKER_LOOK.camZ,
            ],
            fov: BASE_FOV,
          }}
          frameloop="always"
        >
          <LookCamera ballEl={rootEl} />
          <ambientLight intensity={look.ambient} color="#ffffff" />
          {/* Dark ground → underside falloff without killing the key highlight. */}
          <hemisphereLight args={["#ffffff", "#050403", look.hemi]} />
          <directionalLight
            position={[look.keyX, look.keyY, look.keyZ]}
            intensity={look.key}
            color="#ffffff"
          />
          <directionalLight
            position={[look.fillX, look.fillY, look.fillZ]}
            intensity={look.fill}
            color="#f5f0e8"
          />
          <directionalLight
            position={[look.rimX, look.rimY, look.rimZ]}
            intensity={look.rim}
            color="#A89C87"
          />
          <FallingShell
            progressRef={progressRef}
            look={look}
            windowEl={windowEl}
            onLanded={onBallLanded}
          />
        </Canvas>
        <div
          ref={windowEl}
          className="joker-ball__window joker-ball__window--3d"
          aria-hidden="true"
          style={
            {
              background: windowGradientCss(gradient),
              boxShadow: windowShadowCss(windowLook),
              "--joker-num-x": `${windowLook.numOffsetX}px`,
              "--joker-num-y": `${windowLook.numOffsetY}px`,
            } as React.CSSProperties
          }
        >
          <div ref={track} className="joker-ball__track joker-ball__track--3d">
            {NUMBERS.map((n) => (
              <p key={n} className="joker-ball__num joker-ball__num--3d">
                {padJoker(n)}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  },
);
