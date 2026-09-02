import { Float } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useSyncExternalStore } from "react";
import type { Mesh } from "three";

function subscribeReducedMotion(onStoreChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function GemMesh({ paused }: { paused: boolean }) {
  const ref = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (paused || !ref.current) return;
    ref.current.rotation.y += delta * 0.55;
    ref.current.rotation.x = Math.sin(performance.now() * 0.00035) * 0.12;
  });

  return (
    <Float speed={1.6} rotationIntensity={0.25} floatIntensity={0.45}>
      <mesh ref={ref} scale={0.92}>
        <octahedronGeometry args={[1, 0]} />
        <meshPhysicalMaterial
          color="#ffb8dc"
          metalness={0.15}
          roughness={0.04}
          transmission={0.88}
          thickness={1.4}
          ior={2.35}
          iridescence={1}
          iridescenceIOR={1.25}
          iridescenceThicknessRange={[120, 720]}
          clearcoat={1}
          clearcoatRoughness={0.08}
          emissive="#d91e6e"
          emissiveIntensity={0.08}
        />
      </mesh>
    </Float>
  );
}

export function DiamondGem3D({ className }: { className?: string }) {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0.1, 2.8], fov: 42 }}
        dpr={[1, 1.75]}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        style={{ pointerEvents: "none" }}
      >
        <ambientLight intensity={0.35} />
        <pointLight position={[2.5, 2, 2.5]} intensity={2.2} color="#ff8ec4" />
        <pointLight position={[-2, -0.5, 1.5]} intensity={1.4} color="#9333ea" />
        <pointLight position={[0, -2, 1]} intensity={0.6} color="#60a5fa" />
        <GemMesh paused={reducedMotion} />
      </Canvas>
    </div>
  );
}
