import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Army, armyFrame } from "./Army";
import { Castle } from "./Castle";
import { SallyRaid } from "./SallyRaid";
import { CaptureHpHud, ReelFade, ReelTitles } from "./CaptureHpHud";
import { castleFrame } from "../../castleLayout";
import { REEL_HOLD, reelBeats } from "../../recordCanvas";
import {
  cinematicSallyOrigin,
  REEL_SWORD_START,
  SWORD_START,
  sallyLocal,
  setSallyOrigin,
  setSwordStart,
  swordSwingU,
} from "../../siegeEvent";

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

function ease(u: number) {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
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
    const recT = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const { cmd, turn, pullStart } = reelBeats(duration);

    const form = armyFrame(soldiers, commanders);
    const castle = castleFrame(level);
    const swing = swordSwingU(sallyLocal(clock.elapsedTime), Math.max(1, commanders));
    const smash = recT < cmd && swing > 0.28 ? Math.sin(((swing - 0.28) / 0.72) * Math.PI) : 0;
    const shake = smash * 0.05;

    const cmdZ = form.front;
    const a = {
      x: 0.82,
      y: 1.86,
      z: cmdZ - 4.55,
      lx: 0.02,
      ly: 1.62,
      lz: cmdZ + 0.06,
      fov: 29,
    };
    const b = {
      x: Math.min(22, Math.max(13.2, form.width * 0.42 + 8)),
      y: 7.1,
      z: form.back + 7.2,
      lx: -0.8,
      ly: 1.7,
      lz: form.front - 8,
      fov: 42,
    };
    const wide = distToFit(Math.max(form.width, castle.width * 0.42), 14, aspect, 1.05);
    const c = {
      x: 20,
      y: 15.6 + wide * 0.06,
      z: form.back + 18,
      lx: 0,
      ly: 3.2,
      lz: 22,
      fov: 38,
    };

    let t = 0;
    let from = a;
    let to = a;
    if (recT <= cmd) {
      from = a;
      to = a;
      t = 0;
    } else if (recT <= cmd + turn) {
      from = a;
      to = b;
      t = ease((recT - cmd) / turn);
    } else if (recT <= pullStart) {
      from = b;
      to = b;
      t = 0;
    } else {
      from = b;
      to = c;
      t = ease((recT - pullStart) / Math.max(0.5, duration - pullStart - 0.35));
    }

    const persp = camera as THREE.PerspectiveCamera;
    persp.fov = from.fov + (to.fov - from.fov) * t;
    persp.updateProjectionMatrix();
    camera.position.set(
      from.x + (to.x - from.x) * t + shake,
      from.y + (to.y - from.y) * t,
      from.z + (to.z - from.z) * t
    );
    look.set(
      from.lx + (to.lx - from.lx) * t + shake * 0.25,
      from.ly + (to.ly - from.ly) * t,
      from.lz + (to.lz - from.lz) * t
    );
    camera.lookAt(look);
  });
  return null;
}

function useGroundTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#4a8f38";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4200; i++) {
      const n = i % 5;
      ctx.fillStyle = n === 0 ? "#63b34a" : n === 1 ? "#3d7a2c" : n === 2 ? "#5aa83f" : n === 3 ? "#2f6a22" : "#7cbc58";
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 7, 2 + Math.random() * 6);
    }
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = "rgba(90, 70, 40, 0.18)";
      ctx.beginPath();
      ctx.ellipse(Math.random() * 512, Math.random() * 512, 8 + Math.random() * 22, 5 + Math.random() * 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(42, 42);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function SkyDome() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        vertexShader: `
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vPos;
          void main() {
            float h = normalize(vPos).y;
            vec3 zenith = vec3(0.28, 0.52, 0.86);
            vec3 mid = vec3(0.55, 0.74, 0.92);
            vec3 horizon = vec3(0.86, 0.88, 0.9);
            vec3 glow = vec3(1.0, 0.86, 0.62);
            vec3 col = mix(horizon, mid, smoothstep(-0.08, 0.22, h));
            col = mix(col, zenith, smoothstep(0.18, 0.78, h));
            col = mix(col, glow, exp(-pow((h - 0.04) * 7.0, 2.0)) * 0.32);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    []
  );
  return (
    <mesh material={mat} frustumCulled={false}>
      <sphereGeometry args={[1800, 48, 28]} />
    </mesh>
  );
}

function Terrain() {
  const ground = useGroundTexture();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const canopy = useRef<THREE.InstancedMesh>(null);

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
    const trees = [
      [-22, 8], [23, -8], [-20, -14], [21, 16], [-26, 2], [25, -4],
      [-18, 22], [19, -18], [-24, 16], [22, 20], [-48, 18], [52, -22],
      [-60, -8], [58, 14], [-36, 55], [40, 62], [-70, 32], [66, -40],
      [-42, -52], [74, 8], [-80, 20], [28, -68],
    ];
    trees.forEach(([x, z], i) => {
      const s = 0.9 + (i % 4) * 0.18;
      if (trunks.current) {
        dummy.position.set(x, 0.7 * s, z);
        dummy.scale.set(s * 0.35, s, s * 0.35);
        dummy.rotation.set(0, i * 0.4, 0);
        dummy.updateMatrix();
        trunks.current.setMatrixAt(i, dummy.matrix);
      }
      if (canopy.current) {
        dummy.position.set(x, 2.15 * s, z);
        dummy.scale.setScalar(s);
        dummy.rotation.set(0, i * 0.7, 0);
        dummy.updateMatrix();
        canopy.current.setMatrixAt(i, dummy.matrix);
      }
    });
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true;
    if (canopy.current) canopy.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[720, 720]} />
        <meshStandardMaterial map={ground} color="#6bb34f" roughness={0.92} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 13]}>
        <planeGeometry args={[7.4, 24]} />
        <meshStandardMaterial color="#c4a36a" roughness={0.88} />
      </mesh>
      <instancedMesh ref={rocks} args={[undefined, undefined, 24]}>
        <dodecahedronGeometry args={[0.9, 1]} />
        <meshStandardMaterial color="#8a8478" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, 22]}>
        <cylinderGeometry args={[0.22, 0.32, 1.5, 7]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={canopy} args={[undefined, undefined, 22]}>
        <sphereGeometry args={[1.15, 8, 6]} />
        <meshStandardMaterial color="#2f8a38" roughness={0.82} />
      </instancedMesh>
    </group>
  );
}

function DayLights() {
  return (
    <>
      <ambientLight intensity={0.58} color="#e8e4dc" />
      <hemisphereLight args={["#b8c8dc", "#4a7a38", 0.62]} />
      <directionalLight position={[-22, 38, 20]} intensity={2.35} color="#fff6e4" />
      <directionalLight position={[18, 16, 10]} intensity={0.7} color="#c8d4e8" />
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
  day = 0,
}: BattleSceneProps) {
  return (
    <>
      <color attach="background" args={["#87a7c8"]} />
      <fog attach="fog" args={["#c5d4e0", 560, 1600]} />
      <SkyDome />
      <DayLights />
      <Terrain />
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
        <CaptureHpHud hp={hp} maxHp={maxHp} soldiers={soldiers} duration={duration ?? 8} />
      )}
      {cinematic && showTitles && (
        <ReelTitles soldiers={soldiers} duration={duration ?? 8} day={day} />
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
    if (cinematic) {
      setSallyOrigin(cinematicSallyOrigin(REEL_HOLD));
      setSwordStart(REEL_SWORD_START);
    } else {
      setSallyOrigin(0);
      setSwordStart(SWORD_START);
    }
    return () => {
      setSallyOrigin(0);
      setSwordStart(SWORD_START);
    };
  }, [cinematic]);

  useEffect(() => {
    const onVis = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <Canvas
      dpr={[1, cinematic ? 1.5 : 1.5]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
        preserveDrawingBuffer: Boolean(cinematic),
        failIfMajorPerformanceCaveat: false,
      }}
      camera={{ fov: 36, near: 0.5, far: 2200, position: cinematic ? [12, 11, 74] : [9, 21, 96] }}
      frameloop={active ? "always" : "demand"}
      style={{ width: "100%", height: "100%", display: "block" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.32;
        gl.setClearColor("#87a7c8", 1);
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

