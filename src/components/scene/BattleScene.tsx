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
    ctx.fillStyle = "#4f9a3c";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1100; i++) {
      ctx.fillStyle = i % 3 === 0 ? "#68b34a" : i % 3 === 1 ? "#3d7d2e" : "#5aa83f";
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 2 + Math.random() * 5);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(56, 56);
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
        [-6, 18], [7, 22], [-18, 18], [16, 21], [-38, 28], [42, 24],
        [-44, -18], [36, -32], [-28, 48], [52, -8], [-56, 12], [48, 40],
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
        [-18, 22], [19, -18], [-24, 16], [22, 20], [-48, 18], [52, -22],
        [-60, -8], [58, 14], [-36, 55], [40, 62], [-70, 32], [66, -40],
        [-42, -52], [74, 8], [-80, 20], [28, -68],
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
        <planeGeometry args={[720, 720]} />
        <meshLambertMaterial map={ground} color="#5dad45" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 13]}>
        <planeGeometry args={[7, 22]} />
        <meshLambertMaterial color="#c4a36a" />
      </mesh>
      <instancedMesh ref={rocks} args={[undefined, undefined, 24]}>
        <dodecahedronGeometry args={[0.9, 0]} />
        <meshLambertMaterial color="#7a746c" />
      </instancedMesh>
      <instancedMesh ref={trees} args={[undefined, undefined, 22]}>
        <coneGeometry args={[0.9, 3.2, 6]} />
        <meshLambertMaterial color="#2f7a32" />
      </instancedMesh>
    </group>
  );
}

function SceneContent({ soldiers, level, pressure }: BattleSceneProps) {
  return (
    <>
      <color attach="background" args={["#6d7d92"]} />
      <fog attach="fog" args={["#7a8898", 340, 720]} />
      <ambientLight intensity={0.62} color="#e8e4dc" />
      <hemisphereLight args={["#b8c8dc", "#4a7a38", 0.55]} />
      <directionalLight position={[-22, 34, 20]} intensity={2.15} color="#fff6e4" />
      <directionalLight position={[18, 16, 10]} intensity={0.55} color="#c8d4e8" />
      <Terrain />
      <Castle level={level} pressure={pressure} />
      <Army count={soldiers} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={16}
        maxDistance={260}
        minPolarAngle={0.12}
        maxPolarAngle={1.48}
        target={[0, 9, 2]}
        rotateSpeed={0.95}
        zoomSpeed={1}
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
      camera={{ fov: 38, near: 0.5, far: 700, position: [26, 42, 58] }}
      frameloop={active ? "always" : "demand"}
      style={{ width: "100%", height: "100%", display: "block" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.35;
        gl.setClearColor("#6d7d92", 1);
      }}
    >
      <SceneContent soldiers={soldiers} level={level} pressure={pressure} />
    </Canvas>
  );
}

export const BattleScene = memo(BattleSceneInner);
