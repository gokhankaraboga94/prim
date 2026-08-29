import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Army } from "./Army";
import { Castle } from "./Castle";

type BattleSceneProps = {
  soldiers: number;
  level: number;
  pressure: number;
};

function useGroundTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#2a2622";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const n = (i * 13) % 40;
      ctx.fillStyle = i % 4 === 0 ? "#3a3530" : i % 4 === 1 ? "#1f1c19" : "#322e29";
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 3 + n * 0.15, 2 + Math.random() * 4);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(18, 18);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function Terrain() {
  const ground = useGroundTexture();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const trees = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (rocks.current) {
      const spots = [
        [-10, 14], [9, 16], [-14, 10], [13, 11], [-8, 20], [11, 19],
        [-20, 6], [19, 8], [-16, -8], [17, -11], [-22, 14], [21, 15],
        [-6, 18], [7, 22], [-18, 18], [16, 21],
      ];
      spots.forEach(([x, z], i) => {
        dummy.position.set(x, 0.25 + (i % 3) * 0.12, z);
        dummy.scale.set(0.7 + (i % 4) * 0.35, 0.35 + (i % 3) * 0.2, 0.65 + (i % 5) * 0.25);
        dummy.rotation.set(0.2, i * 0.8, 0.1);
        dummy.updateMatrix();
        rocks.current!.setMatrixAt(i, dummy.matrix);
      });
      rocks.current.instanceMatrix.needsUpdate = true;
    }
    if (trees.current) {
      const spots = [
        [-22, 8], [23, -8], [-20, -14], [21, 16], [-26, 2], [25, -4],
        [-18, 22], [19, -18], [-24, 16], [22, 20],
      ];
      spots.forEach(([x, z], i) => {
        dummy.position.set(x, 1.4, z);
        dummy.scale.setScalar(0.9 + (i % 4) * 0.18);
        dummy.rotation.set(0, i * 0.7, 0);
        dummy.updateMatrix();
        trees.current!.setMatrixAt(i, dummy.matrix);
      });
      trees.current.instanceMatrix.needsUpdate = true;
    }
  }, [dummy]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[160, 160]} />
        <meshLambertMaterial map={ground} color="#2c2824" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 13]}>
        <planeGeometry args={[7, 22]} />
        <meshLambertMaterial color="#3a3228" />
      </mesh>
      <instancedMesh ref={rocks} args={[undefined, undefined, 16]}>
        <dodecahedronGeometry args={[0.9, 0]} />
        <meshLambertMaterial color="#3d3a36" />
      </instancedMesh>
      <instancedMesh ref={trees} args={[undefined, undefined, 10]}>
        <coneGeometry args={[0.9, 3.2, 6]} />
        <meshLambertMaterial color="#141810" />
      </instancedMesh>
    </group>
  );
}

function SceneContent({ soldiers, level, pressure }: BattleSceneProps) {
  return (
    <>
      <color attach="background" args={["#07090d"]} />
      <fog attach="fog" args={["#0a0d12", 42, 130]} />
      <ambientLight intensity={0.16} color="#6a7380" />
      <hemisphereLight args={["#1a2433", "#0c0a08", 0.28]} />
      <directionalLight position={[-32, 26, 18]} intensity={1.55} color="#d4e0f0" />
      <directionalLight position={[14, 10, -8]} intensity={0.22} color="#3a2a18" />
      <Terrain />
      <Castle level={level} pressure={pressure} />
      <Army count={soldiers} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={24}
        maxDistance={120}
        minPolarAngle={0.42}
        maxPolarAngle={1.22}
        target={[0, 2.4, 1]}
        rotateSpeed={0.7}
        zoomSpeed={0.85}
      />
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
        depth: true,
        failIfMajorPerformanceCaveat: false,
      }}
      camera={{ fov: 38, near: 0.5, far: 220, position: [16, 28, 36] }}
      frameloop={active ? "always" : "demand"}
      style={{ width: "100%", height: "100%", display: "block" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.setClearColor("#07090d", 1);
      }}
    >
      <SceneContent soldiers={soldiers} level={level} pressure={pressure} />
    </Canvas>
  );
}

export const BattleScene = memo(BattleSceneInner);
