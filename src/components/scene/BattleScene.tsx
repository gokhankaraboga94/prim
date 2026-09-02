import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Army, armyFrame } from "./Army";
import { Castle } from "./Castle";
import { SallyRaid } from "./SallyRaid";
import { CaptureHpHud, ReelFade, ReelTitles } from "./CaptureHpHud";
import { WarGrade } from "./WarGrade";
import { castleFrame } from "../../castleLayout";
import { REEL_HOLD, reelHook, reelZoomDur } from "../../recordCanvas";
import { cinematicSallyOrigin, sallyLocal, setSallyOrigin, swordSwingU } from "../../siegeEvent";

type BattleSceneProps = {
  soldiers: number;
  names?: string[];
  commanders?: string[];
  level: number;
  pressure: number;
  hp?: number;
  maxHp?: number;
  cinematic?: boolean;
  duration?: number;
  showTitles?: boolean;
  warLook?: boolean;
  day?: number;
  onReady?: (canvas: HTMLCanvasElement) => void;
};

const CAM_FOV = 36 * (Math.PI / 180);

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
  commanders = 0,
}: {
  duration: number;
  soldiers: number;
  level: number;
  commanders?: number;
}) {
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, clock, size }) => {
    const aspect = size.width / Math.max(1, size.height);
    const recT = clock.elapsedTime - REEL_HOLD;
    const hold = reelHook(duration);
    const zoomDur = reelZoomDur(duration);
    const u = recT <= hold ? 0 : Math.min(1, (recT - hold) / zoomDur);
    const e = 1 - Math.pow(1 - u, 2.55);
    const after = Math.max(0, recT - hold - zoomDur);
    const rest = Math.max(0.4, duration - hold - zoomDur);
    const drift = Math.min(1, after / rest);

    const army = armyFrame(soldiers, commanders);
    const castle = castleFrame(level);
    const swing = swordSwingU(sallyLocal(clock.elapsedTime), Math.max(1, commanders));
    const smash = swing > 0.38 ? Math.sin(((swing - 0.38) / 0.62) * Math.PI) : 0;
    const shake = smash * 0.18;

    const startX = 5.15;
    const startY = 2.42;
    const startZ = army.front + 8.6;
    const startLookY = 1.52;
    const startLookZ = army.front - 1.8;

    const endDist = distToFit(castle.width * 0.7, castle.height * 1.08, aspect, 1.1);
    const endX = 7.2;
    const endY = castle.midY + endDist * 0.4;
    const endZ = castle.front + endDist * 0.68;
    const endLookY = castle.midY * 0.7;
    const endLookZ = castle.midZ + 1.6;

    const persp = camera as THREE.PerspectiveCamera;
    persp.fov = 28 + 11 * e;
    persp.updateProjectionMatrix();
    camera.position.set(
      startX + (endX - startX) * e + shake + drift * 3.2,
      startY + (endY - startY) * e + drift * 1.4,
      startZ + (endZ - startZ) * e - drift * 2.4
    );
    look.set(
      shake * 0.35 + drift * 0.6,
      startLookY + (endLookY - startLookY) * e,
      startLookZ + (endLookZ - startLookZ) * e
    );
    camera.lookAt(look);
  });
  return null;
}

function useGroundTexture(night: boolean) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = night ? "#1a2412" : "#4f9a3c";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1100; i++) {
      ctx.fillStyle = night
        ? i % 3 === 0
          ? "#2a3a18"
          : i % 3 === 1
            ? "#121a0c"
            : "#243214"
        : i % 3 === 0
          ? "#68b34a"
          : i % 3 === 1
            ? "#3d7d2e"
            : "#5aa83f";
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 2 + Math.random() * 5);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(56, 56);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [night]);
}

function Terrain({ night }: { night: boolean }) {
  const ground = useGroundTexture(night);
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
        <meshLambertMaterial map={ground} color={night ? "#243218" : "#5dad45"} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 13]}>
        <planeGeometry args={[7, 22]} />
        <meshLambertMaterial color={night ? "#3a2818" : "#c4a36a"} />
      </mesh>
      <instancedMesh ref={rocks} args={[undefined, undefined, 24]}>
        <dodecahedronGeometry args={[0.9, 0]} />
        <meshLambertMaterial color={night ? "#3a3630" : "#7a746c"} />
      </instancedMesh>
      <instancedMesh ref={trees} args={[undefined, undefined, 22]}>
        <coneGeometry args={[0.9, 3.2, 6]} />
        <meshLambertMaterial color={night ? "#0f2414" : "#2f7a32"} />
      </instancedMesh>
    </group>
  );
}

function Embers() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 70;
    const pos = new Float32Array(n * 3);
    const speed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 38;
      pos[i * 3 + 1] = Math.random() * 15;
      pos[i * 3 + 2] = -6 + Math.random() * 40;
      speed[i] = 0.55 + Math.random() * 0.9;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.userData.speed = speed;
    return g;
  }, []);

  useFrame((_, dt) => {
    const arr = geo.attributes.position.array as Float32Array;
    const speed = geo.userData.speed as Float32Array;
    for (let i = 0; i < speed.length; i++) {
      arr[i * 3 + 1] += dt * speed[i] * 1.6;
      arr[i * 3] += Math.sin(arr[i * 3 + 1] * 0.4 + i) * dt * 0.35;
      if (arr[i * 3 + 1] > 16) {
        arr[i * 3 + 1] = 0.2;
        arr[i * 3] = (Math.random() - 0.5) * 38;
        arr[i * 3 + 2] = -6 + Math.random() * 40;
      }
    }
    geo.attributes.position.needsUpdate = true;
  });

  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial color="#ffb060" size={0.28} transparent opacity={0.82} depthWrite={false} sizeAttenuation />
    </points>
  );
}

function DayLights() {
  return (
    <>
      <ambientLight intensity={0.62} color="#e8e4dc" />
      <hemisphereLight args={["#b8c8dc", "#4a7a38", 0.55]} />
      <directionalLight position={[-22, 34, 20]} intensity={2.15} color="#fff6e4" />
      <directionalLight position={[18, 16, 10]} intensity={0.55} color="#c8d4e8" />
    </>
  );
}

function NightLights({ pressure }: { pressure: number }) {
  const fire = 1.4 + pressure * 1.8;
  return (
    <>
      <ambientLight intensity={0.22} color="#3a2a22" />
      <hemisphereLight args={["#2a3048", "#120a06", 0.32]} />
      <directionalLight position={[48, 42, -18]} intensity={0.28} color="#8aa0c8" />
      <directionalLight position={[-16, 22, 28]} intensity={0.55} color="#ff8a3a" />
      <pointLight position={[0, 7.5, 8]} color="#ff6a22" intensity={fire * 2.4} distance={42} decay={2} />
      <pointLight position={[-18, 9, 14]} color="#ff7a28" intensity={1.6} distance={26} decay={2} />
      <pointLight position={[18, 9, 14]} color="#ff7a28" intensity={1.6} distance={26} decay={2} />
      <pointLight position={[0, 5.5, 50]} color="#ffb060" intensity={2.8} distance={24} decay={2} />
      <pointLight position={[0, 4.2, 36]} color="#ff8a40" intensity={2.4} distance={22} decay={2} />
      <pointLight position={[4.2, 3.2, 49]} color="#ffe0a8" intensity={1.1} distance={12} decay={2} />
    </>
  );
}

function SceneContent({
  soldiers,
  names = [],
  commanders = [],
  level,
  pressure,
  hp,
  maxHp,
  cinematic,
  duration,
  showTitles = true,
  warLook = false,
  day = 0,
}: BattleSceneProps) {
  const night = Boolean(cinematic);
  return (
    <>
      {warLook && <WarGrade />}
      <color attach="background" args={[night ? "#07050c" : "#6d7d92"]} />
      <fog attach="fog" args={[night ? "#100c12" : "#7a8898", night ? 90 : 340, night ? 420 : 720]} />
      {night ? <NightLights pressure={pressure} /> : <DayLights />}
      <Terrain night={night} />
      {night && <Embers />}
      <Castle level={level} pressure={pressure} />
      <SallyRaid soldiers={soldiers} commanders={commanders.length} />
      <Army count={soldiers} names={names} commanders={commanders} cinematic={cinematic} />
      {cinematic ? (
        <CinematicCam
          duration={duration ?? 8}
          soldiers={soldiers}
          level={level}
          commanders={commanders.length}
        />
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
      {cinematic && maxHp != null && hp != null && (
        <CaptureHpHud hp={hp} maxHp={maxHp} soldiers={soldiers} overlay />
      )}
      {cinematic && showTitles && (
        <ReelTitles soldiers={soldiers} duration={duration ?? 8} overlay day={day} />
      )}
      {cinematic && <ReelFade duration={duration ?? 8} />}
    </>
  );
}

function BattleSceneInner({
  soldiers,
  names,
  commanders,
  level,
  pressure,
  hp,
  maxHp,
  cinematic,
  duration,
  showTitles,
  warLook,
  day,
  onReady,
}: BattleSceneProps) {
  const [active, setActive] = useState(() => typeof document === "undefined" || !document.hidden);

  useLayoutEffect(() => {
    if (cinematic) setSallyOrigin(cinematicSallyOrigin(REEL_HOLD));
    else setSallyOrigin(0);
    return () => setSallyOrigin(0);
  }, [cinematic]);

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
      camera={{ fov: 36, near: 0.5, far: 700, position: cinematic ? [12, 11, 74] : [9, 21, 96] }}
      frameloop={active ? "always" : "demand"}
      style={{ width: "100%", height: "100%", display: "block" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = cinematic ? 1.18 : 1.35;
        gl.setClearColor(cinematic ? "#07050c" : "#6d7d92", 1);
        onReady?.(gl.domElement);
      }}
    >
      <SceneContent
        soldiers={soldiers}
        names={names}
        commanders={commanders}
        level={level}
        pressure={pressure}
        hp={hp}
        maxHp={maxHp}
        cinematic={cinematic}
        duration={duration}
        showTitles={showTitles}
        warLook={warLook}
        day={day}
      />
    </Canvas>
  );
}

export const BattleScene = memo(BattleSceneInner);
