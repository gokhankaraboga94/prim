import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Army } from "./Army";
import { Castle } from "./Castle";

type BattleSceneProps = {
  soldiers: number;
  level: number;
  pressure: number;
};

function makePoints(count: number, place: (i: number, arr: Float32Array) => void) {
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) place(i, arr);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  return geom;
}

function Stars() {
  const ref = useRef<THREE.Points>(null);
  const geom = useMemo(
    () =>
      makePoints(140, (i, arr) => {
        arr[i * 3] = (Math.random() - 0.5) * 90;
        arr[i * 3 + 1] = 8 + Math.random() * 28;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 50 - 10;
      }),
    []
  );

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.006;
  });

  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial color="#ffe9b0" size={0.22} transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

function EmberField({ pressure }: { pressure: number }) {
  const ref = useRef<THREE.Points>(null);
  const geom = useMemo(
    () =>
      makePoints(50, (i, arr) => {
        arr[i * 3] = (Math.random() - 0.5) * 22;
        arr[i * 3 + 1] = Math.random() * 5;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 16;
      }),
    []
  );

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.y = (state.clock.elapsedTime * 0.3) % 1.6;
    (ref.current.material as THREE.PointsMaterial).opacity = 0.2 + pressure * 0.4;
  });

  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial color="#ff7a3c" size={0.2} transparent opacity={0.28} depthWrite={false} />
    </points>
  );
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]}>
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial color="#2a231c" roughness={1} />
    </mesh>
  );
}

function CameraRig({ pressure }: { pressure: number }) {
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const shake = pressure > 0.85 ? Math.sin(t * 28) * 0.03 : 0;
    state.camera.position.set(Math.sin(t * 0.05) * 1.8 + shake, 6.4, 14.5);
    state.camera.lookAt(0, 2.6, -5);
  });
  return null;
}

function SceneContent({ soldiers, level, pressure }: BattleSceneProps) {
  return (
    <>
      <color attach="background" args={["#1a1410"]} />
      <fog attach="fog" args={["#1a1410", 28, 70]} />
      <ambientLight intensity={0.7} color="#cbb394" />
      <hemisphereLight args={["#8ea0c8", "#3a2a1c", 0.8]} />
      <directionalLight position={[8, 14, 10]} intensity={1.8} color="#ffe6b8" />
      <pointLight position={[0, 5, -6]} intensity={2.2} color="#ff8a4a" distance={28} />
      <Stars />
      <Ground />
      <Castle level={level} pressure={pressure} />
      <Army count={soldiers} pressure={pressure} />
      <EmberField pressure={pressure} />
      <CameraRig pressure={pressure} />
    </>
  );
}

function BattleSceneInner({ soldiers, level, pressure }: BattleSceneProps) {
  const [active, setActive] = useState(() => typeof document === "undefined" || !document.hidden);

  useEffect(() => {
    const onVis = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <Canvas
      dpr={[1, 1.25]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
        failIfMajorPerformanceCaveat: false,
      }}
      camera={{ fov: 46, near: 0.1, far: 90, position: [0, 6.4, 14.5] }}
      frameloop={active ? "always" : "demand"}
      style={{ width: "100%", height: "100%", display: "block" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.35;
        gl.setClearColor("#1a1410", 1);
      }}
    >
      <SceneContent soldiers={soldiers} level={level} pressure={pressure} />
    </Canvas>
  );
}

export const BattleScene = memo(BattleSceneInner);
