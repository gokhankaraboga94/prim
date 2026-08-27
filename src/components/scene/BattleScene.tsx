import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents } from "@react-three/drei";
import * as THREE from "three";
import { Army } from "./Army";
import { Castle } from "./Castle";

type BattleSceneProps = {
  soldiers: number;
  level: number;
  pressure: number;
};

function Stars() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const n = 160;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 120;
      arr[i * 3 + 1] = 12 + Math.random() * 40;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 80 - 20;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.008;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#f4e2b3" size={0.18} transparent opacity={0.7} depthWrite={false} />
    </points>
  );
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 4]} receiveShadow={false}>
      <planeGeometry args={[140, 140]} />
      <meshStandardMaterial color="#12100e" roughness={1} metalness={0} />
    </mesh>
  );
}

function EmberField({ pressure }: { pressure: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const n = 70;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 30;
      arr[i * 3 + 1] = Math.random() * 6;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.y = (state.clock.elapsedTime * 0.35) % 2;
    const mat = ref.current.material as THREE.PointsMaterial;
    mat.opacity = 0.12 + pressure * 0.45;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#ff5a2a" size={0.16} transparent opacity={0.2} depthWrite={false} />
    </points>
  );
}

function CameraRig({ pressure }: { pressure: number }) {
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const shake = pressure > 0.8 ? Math.sin(t * 42) * 0.05 : 0;
    state.camera.position.x = Math.sin(t * 0.07) * 3.2 + shake;
    state.camera.position.y = 9.5 + Math.sin(t * 0.11) * 0.4;
    state.camera.position.z = 26 + Math.cos(t * 0.07) * 1.4;
    state.camera.lookAt(0, 3.2, -10);
  });
  return null;
}

function SceneContent({ soldiers, level, pressure }: BattleSceneProps) {
  return (
    <>
      <color attach="background" args={["#07060a"]} />
      <fog attach="fog" args={["#07060a", 18, 72]} />
      <ambientLight intensity={0.22} color="#6e5a3d" />
      <hemisphereLight args={["#4a3a28", "#0a0806", 0.55]} />
      <directionalLight position={[12, 18, 8]} intensity={1.05} color="#ffd7a1" />
      <pointLight position={[0, 6, -12]} intensity={1.6 + pressure} color="#ff6a32" distance={32} />
      <pointLight position={[-10, 4, 4]} intensity={0.5} color="#7aa0ff" distance={24} />
      <Stars />
      <Ground />
      <Castle level={level} pressure={pressure} />
      <Army count={soldiers} pressure={pressure} />
      <EmberField pressure={pressure} />
      <CameraRig pressure={pressure} />
    </>
  );
}

export function BattleScene({ soldiers, level, pressure }: BattleSceneProps) {
  const [active, setActive] = useState(() => typeof document === "undefined" || !document.hidden);

  useEffect(() => {
    const onVis = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <Canvas
      className="battle-canvas"
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
      }}
      camera={{ fov: 42, near: 0.1, far: 120, position: [0, 10, 26] }}
      frameloop={active ? "always" : "demand"}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.12;
      }}
    >
      <AdaptiveDpr pixelated={false} />
      <AdaptiveEvents />
      <SceneContent soldiers={soldiers} level={level} pressure={pressure} />
    </Canvas>
  );
}
