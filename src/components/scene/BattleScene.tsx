import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Army, armyFrame } from "./Army";
import { Castle } from "./Castle";
import { SallyRaid } from "./SallyRaid";
import { CaptureHpHud, CountdownFlash, HuntSightHud, New2RatioBar, ReelFade, ReelTitles, ReelVignette, SpinNameHud, XxxHookHud } from "./CaptureHpHud";
import { effectiveCommanders } from "../../game";
import { castleFrame } from "../../castleLayout";
import { REEL_HEIGHT, REEL_HOLD, REEL_WIDTH, reelBeats } from "../../recordCanvas";
import { CINEMA_SWORD_P, cinemaGateAt, sampleCinema, sampleShotMode, type ShotId } from "../../shotModes";
import { rosterSoldierIds, sampleRoster, type PlanBId } from "../../rosterReel";
import { sagaGateRecT, sampleSaga, type SagaId } from "../../sagaReel";
import { discoverGateRecT, sampleDiscover, type DiscoverId } from "../../discoverReel";
import { countdownShake, sampleCountdown, type CountdownId } from "../../countdownReel";
import { DEFEND2_SORTIE, isDefend3, isDefend4, isDefendSortie, sampleDefendCam, type DefendId } from "../../defendReel";
import { isVs, isVs2, sampleVsCam, type VsId } from "../../vsReel";
import { sampleNew1Cam, sampleNew2Cam, sampleNew5Cam, sampleNew6Cam, sampleNew62Cam, sampleNew7Cam, type New1Id, type New2Id, type New3Id, type New4Id, type New5Id, type New6Id, type New62Id, type New7Id } from "../../new1Reel";
import { sampleXxxCam, xxxAdHook, xxxClearHook, xxxCloseNames, xxxDocHook, xxxHasHook, xxxHideCmd, xxxHiRes, xxxHoldHook, xxxHuntHook, xxxHuntSight, xxxInstantHook, xxxQuiet, xxxScanHunt, xxxSpin, xxxSquare, type XxxId } from "../../xxxReel";
import { MIX8_ID, MIX9_SLOW, isMix9, mixBodyPass, mixTagPass, sampleMixBottom, sampleMixTop, type MixId } from "../../mixReel";
import { DefendRing } from "./DefendRing";
import { VsFoes } from "./VsFoes";
import { New1Foes } from "./New1Foes";
import { VsLadders } from "./VsLadders";
import { Catapults } from "./Catapults";
import { NameScanBeam } from "./NameScanBeam";
import {
  SALLY_START_DELAY,
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
  skipCommander?: boolean;
  shotMode?: ShotId | null;
  cinema?: boolean;
  roster?: PlanBId | null;
  saga?: SagaId | null;
  discover?: DiscoverId | null;
  countdown?: CountdownId | null;
  defend?: DefendId | null;
  vs?: VsId | null;
  new1?: New1Id | null;
  new2?: New2Id | null;
  new3?: New3Id | null;
  new4?: New4Id | null;
  new5?: New5Id | null;
  new6?: New6Id | null;
  new62?: New62Id | null;
  new7?: New7Id | null;
  mix?: MixId | null;
  xxx?: XxxId | null;
  rosterIds?: number[] | null;
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
  names = [],
  level,
  commanders = 0,
  skipCommander = false,
  shotMode = null,
  cinema = false,
  roster = null,
  saga = null,
  discover = null,
  countdown = null,
  defend = null,
  vs = null,
  new1 = null,
  new2 = null,
  new3 = null,
  new4 = null,
  new5 = null,
  new6 = null,
  new62 = null,
  new7 = null,
  xxx = null,
  rosterIds = null,
}: {
  duration: number;
  soldiers: number;
  names?: string[];
  level: number;
  commanders?: number;
  skipCommander?: boolean;
  shotMode?: ShotId | null;
  cinema?: boolean;
  roster?: PlanBId | null;
  saga?: SagaId | null;
  discover?: DiscoverId | null;
  countdown?: CountdownId | null;
  defend?: DefendId | null;
  vs?: VsId | null;
  new1?: New1Id | null;
  new2?: New2Id | null;
  new3?: New3Id | null;
  new4?: New4Id | null;
  new5?: New5Id | null;
  new6?: New6Id | null;
  new62?: New62Id | null;
  new7?: New7Id | null;
  xxx?: XxxId | null;
  rosterIds?: number[] | null;
}) {
  const look = useMemo(() => new THREE.Vector3(), []);
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera, clock, size }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      perspCam.current = camera as THREE.PerspectiveCamera;
    }
    const persp = perspCam.current;
    if (!persp) return;
    const aspect = size.width / Math.max(1, size.height);
    const recT = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const { cmd, turn, pullStart } = reelBeats(duration, skipCommander);

    const form = armyFrame(soldiers, commanders, Boolean(xxx && xxxSquare(xxx)));
    const castle = castleFrame(level);
    const swing = swordSwingU(sallyLocal(clock.elapsedTime), Math.max(1, commanders));
    const smash = swing > 0.22 ? Math.sin(((swing - 0.22) / 0.78) * Math.PI) : 0;
    const cShake = countdown ? countdownShake(recT) : 0;
    const shake = discover ? cShake : cShake + smash * (recT < cmd + 0.35 ? 0.11 : 0.04);

    const cmdZ = form.front;
    const a0 = {
      x: 0.85,
      y: 2.15,
      z: cmdZ - 9.2,
      lx: 0.02,
      ly: 1.22,
      lz: cmdZ,
      fov: 30,
    };
    const a = {
      x: 1.35,
      y: 2.35,
      z: cmdZ - 11.2,
      lx: 0.03,
      ly: 1.18,
      lz: cmdZ,
      fov: 34,
    };
    const spanX = Math.max(form.width, 12);
    const spanZ = Math.max(8, form.back - form.front + 6);
    const fit = distToFit(spanX, spanZ, aspect, 1.2);
    const b = {
      x: Math.min(7, spanX * 0.08),
      y: 10.4 + fit * 0.05,
      z: form.back + Math.max(14, fit * 0.48),
      lx: 0,
      ly: 1.42,
      lz: form.midZ,
      fov: 48,
    };
    const castleFit = distToFit(castle.width, castle.height, aspect, 1.18);
    const c = {
      x: castle.width * 0.1,
      y: castle.midY + 62 + castleFit * 0.28,
      z: castle.midZ + castleFit * 0.48,
      lx: 0,
      ly: castle.midY * 0.78,
      lz: castle.midZ + 6,
      fov: 38,
    };

    if (cinema || shotMode || roster || saga || discover || countdown || defend || vs || new1 || new2 || new3 || new4 || new5 || new6 || new62 || new7 || xxx) {
      const sampleT = recT;
      const ctx = { cmdZ, form, castle, fit, castleFit, level };
      const pose = xxx
        ? sampleXxxCam(sampleT, ctx, xxx)
        : new7
        ? sampleNew7Cam(sampleT)
        : new62
        ? sampleNew62Cam(sampleT)
        : new6
        ? sampleNew6Cam(sampleT)
        : new5
        ? sampleNew5Cam(sampleT)
        : new2 || new3 || new4
        ? sampleNew2Cam(sampleT, soldiers)
        : new1
        ? sampleNew1Cam(sampleT, soldiers)
        : vs
        ? sampleVsCam(sampleT, soldiers, level, vs)
        : defend
        ? sampleDefendCam(sampleT, soldiers, defend, level)
        : countdown
        ? sampleCountdown(sampleT, ctx)
        : discover
        ? sampleDiscover(sampleT, ctx, discover)
        : roster
          ? sampleRoster(roster, sampleT, duration, ctx, rosterIds?.length ? rosterIds : rosterSoldierIds(names, soldiers))
          : saga
            ? sampleSaga(saga, sampleT, duration, ctx)
            : cinema
              ? sampleCinema(sampleT, duration, ctx)
              : sampleShotMode(shotMode as ShotId, sampleT, duration, skipCommander, ctx);
      persp.fov = pose.fov;
      if (defend || vs || new1 || new2 || new3 || new4 || new5 || new6 || new62 || new7 || xxx) {
        persp.near = 0.8;
        persp.far = 6000;
      }
      persp.updateProjectionMatrix();
      persp.position.set(pose.x + shake, pose.y, pose.z);
      look.set(pose.lx + shake * 0.25, pose.ly, pose.lz);
      persp.up.set(0, 1, 0);
      persp.lookAt(look);
      return;
    }

    let t = 0;
    let from = a;
    let to = a;
    const warm = clock.elapsedTime;
    if (warm < REEL_HOLD) {
      const u = warm / REEL_HOLD;
      if (skipCommander) {
        from = u < 0.45 ? c : b;
        to = from;
        t = 0;
      } else if (u < 0.32) {
        from = b;
        to = b;
        t = 0;
      } else if (u < 0.62) {
        from = c;
        to = c;
        t = 0;
      } else {
        from = a0;
        to = a0;
        t = 0;
      }
    } else if (recT <= cmd) {
      from = a0;
      to = a;
      t = ease(recT / Math.max(0.25, cmd));
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

    persp.fov = from.fov + (to.fov - from.fov) * t;
    persp.updateProjectionMatrix();
    persp.position.set(
      from.x + (to.x - from.x) * t + shake,
      from.y + (to.y - from.y) * t,
      from.z + (to.z - from.z) * t
    );
    look.set(
      from.lx + (to.lx - from.lx) * t + shake * 0.25,
      from.ly + (to.ly - from.ly) * t,
      from.lz + (to.lz - from.lz) * t
    );
    persp.lookAt(look);
  });
  return null;
}

function applyMixCam(cam: THREE.PerspectiveCamera, p: { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number }, aspect: number) {
  cam.aspect = aspect;
  cam.fov = p.fov;
  cam.near = 0.35;
  cam.far = 2400;
  cam.position.set(p.x, p.y, p.z);
  cam.lookAt(p.lx, p.ly, p.lz);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
}

function MixSplitCam({
  duration,
  soldiers,
  level,
  commanders = 0,
  mix,
}: {
  duration: number;
  soldiers: number;
  level: number;
  commanders?: number;
  mix: MixId;
}) {
  const topCam = useMemo(() => new THREE.PerspectiveCamera(30, 1.125, 0.35, 2400), []);
  const botCam = useMemo(() => new THREE.PerspectiveCamera(34, 1.125, 0.35, 2400), []);
  useFrame(({ gl, scene, size, clock }) => {
    const aspect = size.width / Math.max(1, size.height * 0.5);
    const recT = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const sampleT = recT;
    const form = armyFrame(soldiers, commanders);
    const castle = castleFrame(level);
    const spanX = Math.max(form.width, 12);
    const spanZ = Math.max(8, form.back - form.front + 6);
    const fit = distToFit(spanX, spanZ, aspect, 1.2);
    const castleFit = distToFit(castle.width, castle.height, aspect, 1.18);
    const ctx = { cmdZ: form.front, form, castle, fit, castleFit, level };
    applyMixCam(topCam, sampleMixTop(sampleT, ctx, mix), aspect);
    applyMixCam(botCam, sampleMixBottom(sampleT, ctx, mix, duration), aspect);
    const swap = mix === MIX8_ID;
    const lowerCam = swap ? topCam : botCam;
    const upperCam = swap ? botCam : topCam;
    const lowerTags = swap ? "top" : "bottom";
    const upperTags = swap ? "bottom" : "top";
    const w = size.width;
    const h = size.height;
    const gap = 3;
    const half = Math.floor(h / 2);
    const elapsed = clock.elapsedTime;
    const rec = Math.max(0, elapsed - REEL_HOLD);
    const slowT = elapsed < REEL_HOLD ? elapsed : REEL_HOLD + rec * MIX9_SLOW;
    const slow = isMix9(mix);
    gl.autoClear = true;
    gl.setClearColor("#000000", 1);
    gl.clear();
    gl.setScissorTest(true);
    gl.setViewport(0, 0, w, half - gap);
    gl.setScissor(0, 0, w, half - gap);
    if (slow) mixBodyPass.apply(lowerTags, slowT, lowerCam);
    mixTagPass.apply(lowerTags, lowerCam.position.x, lowerCam);
    gl.render(scene, lowerCam);
    gl.autoClear = false;
    gl.clearDepth();
    gl.setViewport(0, half + gap, w, h - half - gap);
    gl.setScissor(0, half + gap, w, h - half - gap);
    if (slow) mixBodyPass.apply(upperTags, elapsed, upperCam);
    mixTagPass.apply(upperTags, upperCam.position.x, upperCam);
    gl.render(scene, upperCam);
    gl.setScissorTest(false);
    gl.autoClear = true;
    gl.setClearColor("#7eb6ee", 1);
  }, 1);
  return null;
}

function useGroundTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#4e9a38";
    ctx.fillRect(0, 0, 2048, 2048);
    for (let i = 0; i < 28000; i++) {
      const n = i % 7;
      ctx.fillStyle =
        n === 0 ? "#7ec85a" : n === 1 ? "#3d8228" : n === 2 ? "#68b448" : n === 3 ? "#357820" : n === 4 ? "#96d868" : n === 5 ? "#5aa838" : "#2c681c";
      ctx.fillRect(Math.random() * 2048, Math.random() * 2048, 2 + Math.random() * 9, 2 + Math.random() * 8);
    }
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = "rgba(92, 68, 36, 0.24)";
      ctx.beginPath();
      ctx.ellipse(Math.random() * 2048, Math.random() * 2048, 12 + Math.random() * 34, 7 + Math.random() * 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = "rgba(70, 130, 40, 0.12)";
      ctx.beginPath();
      ctx.ellipse(Math.random() * 2048, Math.random() * 2048, 36 + Math.random() * 80, 20 + Math.random() * 46, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(36, 36);
    tex.anisotropy = 16;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function SkyDome({ cheap = false }: { cheap?: boolean }) {
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
        fragmentShader: cheap
          ? `
          varying vec3 vPos;
          void main() {
            float h = normalize(vPos).y;
            vec3 zenith = vec3(0.22, 0.48, 0.92);
            vec3 horizon = vec3(0.62, 0.82, 0.96);
            vec3 col = mix(horizon, zenith, smoothstep(-0.04, 0.72, h));
            gl_FragColor = vec4(col, 1.0);
          }
        `
          : `
          varying vec3 vPos;
          void main() {
            float h = normalize(vPos).y;
            vec3 dir = normalize(vPos);
            vec3 zenith = vec3(0.22, 0.48, 0.92);
            vec3 mid = vec3(0.46, 0.72, 0.98);
            vec3 horizon = vec3(0.62, 0.82, 0.96);
            vec3 col = mix(horizon, mid, smoothstep(-0.06, 0.22, h));
            col = mix(col, zenith, smoothstep(0.2, 0.88, h));
            float sun = pow(max(0.0, dot(dir, normalize(vec3(-0.35, 0.42, 0.28)))), 64.0);
            col += vec3(1.0, 0.93, 0.72) * sun * 1.05;
            vec2 c = dir.xz * (1.4 / max(0.12, dir.y + 0.18));
            float n = fract(sin(dot(floor(c * 3.2), vec2(127.1, 311.7))) * 43758.5453);
            float n2 = fract(sin(dot(floor(c * 7.0 + 2.4), vec2(269.5, 183.3))) * 43758.5453);
            float n3 = fract(sin(dot(floor(c * 13.0 + 5.1), vec2(91.7, 47.3))) * 43758.5453);
            float cloud = smoothstep(0.48, 0.9, n * 0.5 + n2 * 0.32 + n3 * 0.18) * smoothstep(0.02, 0.28, h) * smoothstep(0.78, 0.2, h);
            col = mix(col, vec3(0.95, 0.97, 1.0), cloud * 0.5);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [cheap]
  );
  return (
    <mesh material={mat} frustumCulled={false}>
      <sphereGeometry args={cheap ? [1800, 16, 10] : [1800, 48, 28]} />
    </mesh>
  );
}

function Terrain({ road = true, cheap = false }: { road?: boolean; cheap?: boolean }) {
  const ground = useGroundTexture();
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow={!cheap}>
        <planeGeometry args={[cheap ? 480 : 720, cheap ? 480 : 720]} />
        {cheap ? (
          <meshBasicMaterial map={ground} color="#68b44a" />
        ) : (
          <meshStandardMaterial map={ground} color="#68b44a" roughness={0.92} envMapIntensity={0.2} depthWrite={false} />
        )}
      </mesh>
      {road && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 13]} receiveShadow>
          <planeGeometry args={[9.2, 32]} />
          <meshStandardMaterial color="#a8824c" roughness={0.88} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
      )}
    </group>
  );
}

function SteelSky() {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color("#7eb6ee");
    envScene.add(new THREE.HemisphereLight("#e8f2ff", "#3a2a18", 1.35));
    const sun = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 10), new THREE.MeshBasicMaterial({ color: "#fff1c8" }));
    sun.position.set(-9, 13, 7);
    envScene.add(sun);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(20, 16), new THREE.MeshBasicMaterial({ color: "#3d6a2e" }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.2;
    envScene.add(ground);
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.72;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function useNew1GroundTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#6b5a38";
    ctx.fillRect(0, 0, 2048, 2048);
    for (let i = 0; i < 42000; i++) {
      const n = i % 8;
      ctx.fillStyle =
        n === 0
          ? "#8a7344"
          : n === 1
            ? "#4e4228"
            : n === 2
              ? "#7a6840"
              : n === 3
                ? "#5c4a30"
                : n === 4
                  ? "#3d3420"
                  : n === 5
                    ? "#6e5c34"
                    : n === 6
                      ? "#9a8452"
                      : "#534628";
      ctx.fillRect(Math.random() * 2048, Math.random() * 2048, 1 + Math.random() * 7, 1 + Math.random() * 6);
    }
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = `rgba(42, 32, 18, ${0.12 + Math.random() * 0.22})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * 2048, Math.random() * 2048, 28 + Math.random() * 90, 12 + Math.random() * 36, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(88, 92, 48, ${0.08 + Math.random() * 0.14})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * 2048, Math.random() * 2048, 40 + Math.random() * 120, 22 + Math.random() * 50, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(36, 28, 16, ${0.1 + Math.random() * 0.16})`;
      ctx.lineWidth = 2 + Math.random() * 6;
      ctx.beginPath();
      ctx.moveTo(Math.random() * 2048, Math.random() * 2048);
      ctx.quadraticCurveTo(Math.random() * 2048, Math.random() * 2048, Math.random() * 2048, Math.random() * 2048);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function New6Cross() {
  const ground = useNew1GroundTexture();
  const arm = 172;
  const near = 9.2;
  const mid = near + arm / 2;
  const width = 6;
  const arms = [
    [0, mid],
    [0, -mid],
    [mid, 0],
    [-mid, 0],
  ];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -36, 0]}>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#14181c" roughness={1} />
      </mesh>
      <mesh position={[0, -0.28, 0]}>
        <cylinderGeometry args={[10.5, 10.7, 0.36, 40]} />
        <meshStandardMaterial color="#4a4034" roughness={0.96} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[10.2, 48]} />
        <meshStandardMaterial map={ground} color="#9a7d52" roughness={0.94} metalness={0.02} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[7.4, 36]} />
        <meshStandardMaterial color="#3c3124" roughness={1} transparent opacity={0.42} depthWrite={false} />
      </mesh>
      {arms.map(([x, z], i) => (
        <group key={i}>
          <mesh position={[x, -0.24, z]}>
            <boxGeometry args={[i < 2 ? width + 0.35 : arm, 0.28, i < 2 ? arm : width + 0.35]} />
            <meshStandardMaterial color="#3e352c" roughness={0.98} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, z]}>
            <planeGeometry args={[i < 2 ? width : arm, i < 2 ? arm : width]} />
            <meshStandardMaterial map={ground} color="#8d7546" roughness={0.95} metalness={0.02} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function New5Bridge() {
  const length = 340;
  const z = 118;
  const posts = [];
  const tones = ["#2c3834", "#5a4030", "#243246", "#3a3228", "#1d4034", "#4a3038"];
  for (let i = 0; i < 46; i++) {
    const pz = -16 + i * 7.4;
    const h = 1.4 + (i % 4) * 0.7;
    posts.push(
      <mesh key={`bl${i}`} position={[-6.4, h * 0.5 - 0.3, pz]}>
        <boxGeometry args={[1.15 + (i % 3) * 0.28, h, 1.05]} />
        <meshStandardMaterial color={tones[i % tones.length]} roughness={0.96} />
      </mesh>,
      <mesh key={`br${i}`} position={[6.7, h * 0.38, pz + 3.2]}>
        <boxGeometry args={[0.85 + (i % 2) * 0.4, h * 0.75, 1.35]} />
        <meshStandardMaterial color={tones[(i + 3) % tones.length]} roughness={0.96} />
      </mesh>
    );
  }
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -36, z]}>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#14181c" roughness={1} />
      </mesh>
      {posts}
      <mesh position={[0, -0.22, z]}>
        <boxGeometry args={[7.2, 0.42, length]} />
        <meshStandardMaterial color="#6a6258" roughness={0.92} metalness={0.04} />
      </mesh>
      <mesh position={[-3.4, 0.28, z]}>
        <boxGeometry args={[0.16, 0.7, length]} />
        <meshStandardMaterial color="#3e3832" roughness={0.9} />
      </mesh>
      <mesh position={[3.4, 0.28, z]}>
        <boxGeometry args={[0.16, 0.7, length]} />
        <meshStandardMaterial color="#3e3832" roughness={0.9} />
      </mesh>
    </group>
  );
}

function New4Peak() {
  const ground = useNew1GroundTexture();
  const top = 24;
  const height = 78;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -height, 0]}>
        <planeGeometry args={[1800, 1800]} />
        <meshStandardMaterial color="#1c1814" roughness={1} />
      </mesh>
      <mesh position={[0, -height / 2, 0]}>
        <cylinderGeometry args={[top, top * 0.42, height, 24]} />
        <meshStandardMaterial color="#3a3026" roughness={0.98} metalness={0.02} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <circleGeometry args={[top - 0.15, 24]} />
        <meshStandardMaterial map={ground} color="#8d7546" roughness={0.96} metalness={0.02} />
      </mesh>
    </group>
  );
}

function New1Terrain() {
  const ground = useNew1GroundTexture();
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
        <planeGeometry args={[1200, 1200]} />
        <meshStandardMaterial color="#5a4a32" roughness={1} envMapIntensity={0.08} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[860, 860]} />
        <meshStandardMaterial map={ground} color="#8d7546" roughness={0.96} metalness={0.02} envMapIntensity={0.16} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[42, 36]} />
        <meshStandardMaterial color="#3f3224" roughness={1} transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}

function DayLights({ cinematic = false, slim = false, warm = false }: { cinematic?: boolean; slim?: boolean; warm?: boolean }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  useLayoutEffect(() => {
    const light = sun.current;
    if (!light) return;
    light.castShadow = false;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.near = 8;
    light.shadow.camera.far = 220;
    light.shadow.camera.left = -64;
    light.shadow.camera.right = 64;
    light.shadow.camera.top = 52;
    light.shadow.camera.bottom = -16;
    light.shadow.bias = -0.0008;
    light.shadow.normalBias = 0.04;
  }, [cinematic]);
  return (
    <>
      <ambientLight intensity={slim ? 0.72 : warm ? 0.4 : 0.42} color={warm ? "#e6d4b4" : "#dce6f2"} />
      <hemisphereLight args={[warm ? "#c8b490" : "#9ec4f0", warm ? "#5a4830" : "#548a3c", slim ? 0.55 : warm ? 0.7 : 0.78]} />
      <directionalLight ref={sun} position={warm ? [-22, 36, 10] : [-28, 42, 18]} intensity={slim ? 1.6 : warm ? 2.25 : 2.7} color={warm ? "#ffe2b4" : "#fff4dc"} />
      {!slim && <directionalLight position={[22, 14, 8]} intensity={warm ? 0.42 : 0.55} color={warm ? "#c4a878" : "#a8c4e8"} />}
      {!slim && <directionalLight position={[6, 8, 56]} intensity={warm ? 0.62 : 0.85} color="#ffe0b8" />}
    </>
  );
}

function TimedVisible({ until, children }: { until: number; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (g.current) g.current.visible = clock.elapsedTime - REEL_HOLD < until;
  });
  return <group ref={g}>{children}</group>;
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
  skipCommander = false,
  shotMode = null,
  cinema = false,
  roster = null,
  saga = null,
  discover = null,
  countdown = null,
  defend = null,
  vs = null,
  new1 = null,
  new2 = null,
  new3 = null,
  new4 = null,
  new5 = null,
  new6 = null,
  new62 = null,
  new7 = null,
  mix = null,
  xxx = null,
  rosterIds = null,
}: BattleSceneProps) {
  const chiefs = effectiveCommanders(commanders, names);
  const hideCmd = skipCommander || Boolean(discover) || Boolean(countdown) || Boolean(defend) || Boolean(vs) || Boolean(new1) || Boolean(new2) || Boolean(new3) || Boolean(new4) || Boolean(new5) || Boolean(new6) || Boolean(new62) || Boolean(new7) || Boolean(xxx && xxxHideCmd(xxx));
  const chiefN = hideCmd ? 0 : chiefs.length;
  const split = Boolean(mix);
  const sortie = isDefendSortie(defend);
  const field = isVs(vs);
  const climb = isVs2(vs);
  const chase = Boolean(new5 || new7);
  const relief = Boolean(new7);
  const cross = Boolean(new6 || new62);
  const wide = Boolean(new62);
  const slaughter = Boolean(new1 || new2 || new3 || new4 || new5 || new6 || new62 || new7);
  const duel = Boolean(new2 || new3 || new4);
  const blades = Boolean(new3 || new4 || new5 || new6 || new62 || new7);
  const spin = Boolean(xxx && xxxSpin(xxx));
  if (spin) {
    return (
      <>
        <color attach="background" args={["#000000"]} />
        {cinematic ? (
          <CinematicCam
            duration={duration ?? 8}
            soldiers={soldiers}
            names={names}
            level={level}
            commanders={0}
            skipCommander
            xxx={xxx}
          />
        ) : null}
        {cinematic && <SpinNameHud names={names} soldiers={soldiers} />}
      </>
    );
  }
  return (
    <>
      <color attach="background" args={[slaughter ? "#8f9aa0" : "#7eb6ee"]} />
      <fog attach="fog" args={slaughter ? ["#c4b89a", 240, 980] : defend ? (isDefend3(defend) ? ["#9ec8ee", 1100, 3200] : sortie ? ["#9ec8ee", 600, 2200] : ["#9ec8ee", 1400, 4200]) : field ? ["#9ec8ee", 140, 720] : ["#9ec8ee", 380, 1500]} />
      <SkyDome cheap={Boolean(defend) && !isDefend3(defend)} />
      <SteelSky />
      <DayLights cinematic={cinematic} slim={Boolean(defend) && !isDefend3(defend)} warm={slaughter} />
      {cross ? <New6Cross /> : chase ? <New5Bridge /> : new4 ? <New4Peak /> : slaughter || isDefend4(defend) ? <New1Terrain /> : <Terrain road={!defend && !field} cheap={Boolean(defend)} />}
      {!defend && !field && !slaughter && <Castle level={level} pressure={pressure} gateClosed={Boolean(countdown) || split || climb || Boolean(xxx)} wallFight={climb} />}
      {sortie && (
        <TimedVisible until={DEFEND2_SORTIE + 0.85}>
          <Castle level={level} pressure={pressure} forceGateOpen />
        </TimedVisible>
      )}
      {defend ? (
        <DefendRing soldiers={soldiers} mode={defend} level={level} />
      ) : field ? (
        <VsFoes soldiers={soldiers} />
      ) : slaughter ? (
        <New1Foes soldiers={soldiers} duel={duel} swords={blades} bridge={chase} cross={cross} wide={wide} packed={Boolean(new5)} />
      ) : (
        !roster && !split && !countdown && !vs && !xxx && <SallyRaid soldiers={soldiers} commanders={chiefN} />
      )}
      {climb && <VsLadders level={level} />}
      <Army count={soldiers} names={names} commanders={commanders} cinematic={cinematic} duration={duration} skipCommander={hideCmd} roster={roster} discover={discover} countdown={Boolean(countdown)} defend={Boolean(defend)} defend2={sortie} defend3={isDefend3(defend)} blue={isDefend4(defend)} vs={field} vs2={climb} new1={Boolean(new1)} new2={duel} blade={blades} bridge={chase} cross={cross} wide={wide} relief={relief} mix={split} mixSlow={isMix9(mix)} nameHunt={Boolean(xxx)} quiet={Boolean(xxx && xxxQuiet(xxx)) || slaughter} square={Boolean(xxx && xxxSquare(xxx))} readNames={Boolean(xxx && xxxCloseNames(xxx))} scanHunt={Boolean(xxx && xxxScanHunt(xxx))} level={level} rosterIds={rosterIds} />
      {Boolean(xxx && xxxSquare(xxx)) && <Catapults soldiers={soldiers} square />}
      {Boolean(xxx && xxxScanHunt(xxx)) && <NameScanBeam soldiers={soldiers} />}
      {cinematic && split ? (
        <MixSplitCam duration={duration ?? 15} soldiers={soldiers} level={level} commanders={chiefN} mix={mix!} />
      ) : cinematic ? (
        <CinematicCam
          duration={duration ?? 8}
          soldiers={soldiers}
          names={names}
          level={level}
          commanders={chiefN}
          skipCommander={hideCmd}
          shotMode={shotMode}
          cinema={cinema}
          roster={roster}
          saga={saga}
          discover={discover}
          countdown={countdown}
          defend={defend}
          vs={vs}
          new1={new1}
          new2={new2}
          new3={new3}
          new4={new4}
          new5={new5}
          new6={new6}
          new62={new62}
          new7={new7}
          xxx={xxx}
          rosterIds={rosterIds}
        />
      ) : (
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.06}
          enablePan
          panSpeed={1.25}
          minDistance={2.4}
          maxDistance={720}
          minPolarAngle={0.18}
          maxPolarAngle={1.32}
          target={[0, 6, 30]}
          rotateSpeed={1.2}
          zoomSpeed={1.85}
        />
      )}
      {cinematic && !split && !countdown && !defend && !vs && !slaughter && !xxx && maxHp != null && hp != null && (
        <CaptureHpHud hp={hp} maxHp={maxHp} soldiers={soldiers} duration={duration ?? 8} skipCommander={hideCmd} cinema={cinema} roster={roster} discover={discover} />
      )}
      {cinematic && showTitles && !split && !vs && !slaughter && !xxx && (
        <ReelTitles soldiers={soldiers} duration={duration ?? 8} day={day} skipCommander={hideCmd} cinema={cinema} roster={roster} saga={saga} discover={discover} countdown={countdown} defend={defend} names={names} rosterIds={rosterIds} />
      )}
      {cinematic && xxx && xxxHasHook(xxx) && (
        <XxxHookHud variant={xxxHoldHook(xxx) ? "hold" : xxxHuntHook(xxx) ? "hunt" : xxxDocHook(xxx) ? "doc" : xxxAdHook(xxx) ? "ad" : xxxClearHook(xxx) ? "clear" : "banner"} instant={xxxInstantHook(xxx)} />
      )}
      {cinematic && xxx && xxxHuntSight(xxx) && <HuntSightHud />}
      {cinematic && (duel || chase || cross) && <New2RatioBar soldiers={soldiers} drop={blades ? 64 : 0} bridge={Boolean(new5)} cross={cross} wide={wide} relief={relief} />}
      {cinematic && !split && <ReelVignette />}
      {countdown && <CountdownFlash />}
      {cinematic && !discover && !countdown && !defend && !vs && !slaughter && !split && <ReelFade duration={duration ?? 8} />}
    </>
  );
}

function LockReelBuffer({ dpr = 1 }: { dpr?: number }) {
  const gl = useThree((s) => s.gl);
  const set = useThree((s) => s.set);
  useLayoutEffect(() => {
    gl.setPixelRatio(dpr);
    gl.setSize(REEL_WIDTH, REEL_HEIGHT, false);
    set({ size: { width: REEL_WIDTH, height: REEL_HEIGHT, top: 0, left: 0 } });
  }, [gl, set, dpr]);
  useFrame(() => {
    const w = Math.floor(REEL_WIDTH * dpr);
    const h = Math.floor(REEL_HEIGHT * dpr);
    if (gl.domElement.width !== w || gl.domElement.height !== h) {
      gl.setPixelRatio(dpr);
      gl.setSize(REEL_WIDTH, REEL_HEIGHT, false);
    }
  });
  return null;
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
  skipCommander = false,
  shotMode = null,
  cinema = false,
  roster = null,
  saga = null,
  discover = null,
  countdown = null,
  defend = null,
  vs = null,
  new1 = null,
  new2 = null,
  new3 = null,
  new4 = null,
  new5 = null,
  new6 = null,
  new62 = null,
  new7 = null,
  mix = null,
  xxx = null,
  rosterIds = null,
  onReady,
}: BattleSceneProps) {
  const [active, setActive] = useState(() => typeof document === "undefined" || !document.hidden);
  const hideCmd = skipCommander || Boolean(discover) || Boolean(countdown) || Boolean(defend) || Boolean(vs) || Boolean(new1) || Boolean(new2) || Boolean(new3) || Boolean(new4) || Boolean(new5) || Boolean(new6) || Boolean(new62) || Boolean(new7) || Boolean(xxx && xxxHideCmd(xxx));

  useLayoutEffect(() => {
    if (cinematic && (mix || xxx)) {
      setSallyOrigin(SALLY_START_DELAY - 90);
      setSwordStart(80);
    } else if (cinematic && roster) {
      setSallyOrigin(80);
      setSwordStart(80);
    } else if (cinematic && (countdown || defend || vs || new1 || new2 || new3 || new4 || new5 || new6 || new62 || new7)) {
      setSallyOrigin(SALLY_START_DELAY - 90);
      setSwordStart(80);
    } else if (cinematic && discover) {
      setSallyOrigin(SALLY_START_DELAY - REEL_HOLD - discoverGateRecT(discover));
      setSwordStart(80);
    } else if (cinematic && saga) {
      const gateAt = sagaGateRecT(saga);
      if (gateAt == null) {
        setSallyOrigin(80);
        setSwordStart(80);
      } else {
        setSallyOrigin(SALLY_START_DELAY - REEL_HOLD - gateAt);
        setSwordStart(9.2);
      }
    } else if (cinematic && cinema) {
      setSallyOrigin(SALLY_START_DELAY - REEL_HOLD - cinemaGateAt(duration ?? 30));
      setSwordStart(CINEMA_SWORD_P);
    } else if (cinematic) {
      const beats = reelBeats(duration ?? 8, hideCmd);
      const atStart = 3.04 - beats.pullStart;
      setSallyOrigin(SALLY_START_DELAY + atStart - REEL_HOLD);
      setSwordStart(atStart + 0.04);
    } else {
      setSallyOrigin(0);
      setSwordStart(SWORD_START);
    }
    return () => {
      setSallyOrigin(0);
      setSwordStart(SWORD_START);
    };
  }, [cinematic, cinema, duration, hideCmd, roster, saga, discover, countdown, defend, vs, new1, new2, new3, new4, new5, new6, new62, new7, mix, xxx]);

  useEffect(() => {
    const onVis = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <Canvas
      shadows={!cinematic}
      dpr={cinematic ? (xxx && xxxHiRes(xxx) ? 2 : 1) : [1, 1.5]}
      gl={{
        antialias: Boolean(new1 || new2 || new3 || new4 || new5 || new6 || new62 || new7) || (!(xxx && xxxQuiet(xxx)) && (!defend || isDefend3(defend))),
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
        logarithmicDepthBuffer: !cinematic,
        preserveDrawingBuffer: Boolean(cinematic),
        failIfMajorPerformanceCaveat: false,
      }}
      camera={{ fov: 36, near: 0.35, far: 2400, position: cinematic ? [12, 11, 74] : [9, 21, 96] }}
      frameloop={active ? "always" : "demand"}
      style={{ width: "100%", height: "100%", display: "block" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = cinematic ? (new1 || new2 || new3 || new4 || new5 || new6 || new62 || new7 ? 1.06 : 1.16) : 1.22;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.enabled = !cinematic;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.setClearColor(xxx && xxxSpin(xxx) ? "#000000" : new1 || new2 || new3 || new4 || new5 || new6 || new62 || new7 ? "#8f9aa0" : "#7eb6ee", 1);
        if (cinematic) {
          const dpr = xxx && xxxHiRes(xxx) ? 2 : 1;
          gl.setPixelRatio(dpr);
          gl.setSize(REEL_WIDTH, REEL_HEIGHT, false);
        }
        onReady?.(gl.domElement);
      }}
    >
      {cinematic && <LockReelBuffer dpr={xxx && xxxHiRes(xxx) ? 2 : 1} />}
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
        skipCommander={hideCmd}
        shotMode={shotMode}
        cinema={cinema}
        roster={roster}
        saga={saga}
        discover={discover}
        countdown={countdown}
        defend={defend}
        vs={vs}
        new1={new1}
        new2={new2}
        new3={new3}
        new4={new4}
        new5={new5}
        new6={new6}
        new62={new62}
        new7={new7}
        mix={mix}
        xxx={xxx}
        rosterIds={rosterIds}
      />
    </Canvas>
  );
}

export const BattleScene = memo(BattleSceneInner);

