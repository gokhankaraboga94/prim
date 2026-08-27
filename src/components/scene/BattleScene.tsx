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

function useGrassTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#4f9a3c";
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 420; i++) {
      ctx.fillStyle = i % 3 === 0 ? "#68b34a" : i % 3 === 1 ? "#3d7d2e" : "#5aa83f";
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 5, 2 + Math.random() * 5);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(22, 22);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function Terrain() {
  const grass = useGrassTexture();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const trees = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!trees.current) return;
    const spots = [
      [-18, 12], [-16, -10], [17, 8], [19, -14], [-22, 2], [21, 16],
      [-14, 18], [12, 20], [-20, -16], [16, -20], [-8, 22], [8, -22],
      [-24, 8], [23, -6], [-12, -20], [14, 18],
    ];
    spots.forEach(([x, z], i) => {
      dummy.position.set(x, 1.15, z);
      dummy.scale.setScalar(0.85 + (i % 5) * 0.12);
      dummy.rotation.set(0, i * 0.7, 0);
      dummy.updateMatrix();
      trees.current!.setMatrixAt(i, dummy.matrix);
    });
    trees.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[70, 70]} />
        <meshLambertMaterial map={grass} color="#5dad45" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 10]}>
        <planeGeometry args={[7, 18]} />
        <meshLambertMaterial color="#c4a36a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[16, 16]} />
        <meshLambertMaterial color="#b98d55" />
      </mesh>
      <instancedMesh ref={trees} args={[undefined, undefined, 16]}>
        <coneGeometry args={[1.1, 2.4, 5]} />
        <meshLambertMaterial color="#2f7a32" />
      </instancedMesh>
    </group>
  );
}

function CameraRig() {
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    state.camera.position.set(Math.sin(t * 0.04) * 2.2, 30, 24);
    state.camera.lookAt(0, 0, 1.5);
  });
  return null;
}

function SceneContent({ soldiers, level, pressure }: BattleSceneProps) {
  return (
    <>
      <color attach="background" args={["#8ec5e8"]} />
      <fog attach="fog" args={["#b7d7ef", 45, 85]} />
      <ambientLight intensity={0.85} color="#fff4d6" />
      <hemisphereLight args={["#d7ecff", "#5d8a3e", 0.7]} />
      <directionalLight position={[18, 28, 12]} intensity={1.35} color="#fff3c8" />
      <Terrain />
      <Castle level={level} pressure={pressure} />
      <Army count={soldiers} pressure={pressure} />
      <CameraRig />
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
      dpr={[1, 1.15]}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
        failIfMajorPerformanceCaveat: false,
      }}
      camera={{ fov: 40, near: 0.5, far: 120, position: [0, 30, 24] }}
      frameloop={active ? "always" : "demand"}
      style={{ width: "100%", height: "100%", display: "block" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.setClearColor("#8ec5e8", 1);
      }}
    >
      <SceneContent soldiers={soldiers} level={level} pressure={pressure} />
    </Canvas>
  );
}

export const BattleScene = memo(BattleSceneInner);
