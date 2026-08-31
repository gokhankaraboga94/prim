import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Army, armyFrame } from "./Army";
import { Castle } from "./Castle";
import { SallyRaid } from "./SallyRaid";
import { castleFrame } from "../../castleLayout";

type BattleSceneProps = {
  soldiers: number;
  names?: string[];
  level: number;
  pressure: number;
  cinematic?: boolean;
  duration?: number;
  onReady?: (canvas: HTMLCanvasElement) => void;
};

const CAM_FOV = 36 * (Math.PI / 180);
const REEL_HOLD = 1.05;

function distToFit(width: number, height: number, aspect: number, margin = 1.2) {
  const vHalf = Math.tan(CAM_FOV / 2);
  const hHalf = vHalf * Math.max(0.35, aspect);
  const dH = (height * margin) / (2 * vHalf);
  const dW = (width * margin) / (2 * hHalf);
  return Math.max(dH, dW);
}

function CinematicCam({
  duration,
  soldiers,
  level,
}: {
  duration: number;
  soldiers: number;
  level: number;
}) {
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, clock, size }) => {
    const aspect = size.width / Math.max(1, size.height);
    const u = Math.min(1, Math.max(0, (clock.elapsedTime - REEL_HOLD) / Math.max(0.05, duration)));
    const e = u * u * (3 - 2 * u);

    const army = armyFrame(soldiers);
    const castle = castleFrame(level);

    const startDist = distToFit(army.width, army.height + 2.4, aspect, 1.28);
    const startLookZ = army.midZ;
    const startZ = army.back + startDist * 0.88;
    const startY = 2.2 + startDist * 0.16;

    const endDist = distToFit(castle.width, castle.height, aspect, 1.22);
    const endLookZ = castle.midZ;
    const endZ = castle.front + endDist * 0.78;
    const endY = castle.midY + endDist * 0.36;

    camera.position.set(
      0,
      startY + (endY - startY) * e,
      startZ + (endZ - startZ) * e
    );
    look.set(0, 1.7 + (castle.midY - 1.7) * e, startLookZ + (endLookZ - startLookZ) * e);
    camera.lookAt(look);
  });
  return null;
}

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

function SceneContent({
  soldiers,
  names = [],
  level,
  pressure,
  cinematic,
  duration,
}: BattleSceneProps) {
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
      <SallyRaid soldiers={soldiers} />
      <Army count={soldiers} names={names} />
      {cinematic ? (
        <CinematicCam duration={duration ?? 8} soldiers={soldiers} level={level} />
      ) : (
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          minDistance={16}
          maxDistance={280}
          minPolarAngle={0.12}
          maxPolarAngle={1.48}
          target={[0, 6, 30]}
          rotateSpeed={0.95}
          zoomSpeed={1}
        />
      )}
    </>
  );
}

function BattleSceneInner({
  soldiers,
  names,
  level,
  pressure,
  cinematic,
  duration,
  onReady,
}: BattleSceneProps) {
  const [active, setActive] = useState(() => typeof document === "undefined" || !document.hidden);

  useEffect(() => {
    const onVis = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <Canvas
      dpr={[1, cinematic ? 1.5 : 1.25]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
        preserveDrawingBuffer: Boolean(cinematic),
        failIfMajorPerformanceCaveat: false,
      }}
      camera={{ fov: 36, near: 0.5, far: 700, position: [9, 21, 96] }}
      frameloop={active ? "always" : "demand"}
      style={{ width: "100%", height: "100%", display: "block" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.35;
        gl.setClearColor("#6d7d92", 1);
        onReady?.(gl.domElement);
      }}
    >
      <SceneContent
        soldiers={soldiers}
        names={names}
        level={level}
        pressure={pressure}
        cinematic={cinematic}
        duration={duration}
      />
    </Canvas>
  );
}

export const BattleScene = memo(BattleSceneInner);
