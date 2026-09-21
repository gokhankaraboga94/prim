import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Army, armyFrame } from "./Army";
import { Castle } from "./Castle";
import { SallyRaid } from "./SallyRaid";
import { CaptureHpHud, CountdownFlash, ReelFade, ReelTitles, ReelVignette, XxxHookHud } from "./CaptureHpHud";
import { effectiveCommanders } from "../../game";
import { castleFrame } from "../../castleLayout";
import { REEL_HEIGHT, REEL_HOLD, REEL_WIDTH, reelBeats } from "../../recordCanvas";
import { CINEMA_SWORD_P, cinemaGateAt, sampleCinema, sampleShotMode, type ShotId } from "../../shotModes";
import { rosterSoldierIds, sampleRoster, type PlanBId } from "../../rosterReel";
import { sagaGateRecT, sampleSaga, type SagaId } from "../../sagaReel";
import { discoverGateRecT, sampleDiscover, type DiscoverId } from "../../discoverReel";
import { countdownShake, sampleCountdown, type CountdownId } from "../../countdownReel";
import { DEFEND2_SORTIE, isDefend3, isDefendSortie, sampleDefendCam, type DefendId } from "../../defendReel";
import { isVs, isVs2, sampleVsCam, type VsId } from "../../vsReel";
import { sampleXxxCam, xxxAdHook, xxxClearHook, xxxHasHook, xxxHideCmd, xxxHiRes, xxxInstantHook, xxxQuiet, xxxSquare, type XxxId } from "../../xxxReel";
import { MIX8_ID, MIX9_SLOW, isMix9, mixBodyPass, mixTagPass, sampleMixBottom, sampleMixTop, type MixId } from "../../mixReel";
import { DefendRing } from "./DefendRing";
import { VsFoes } from "./VsFoes";
import { VsLadders } from "./VsLadders";
import { Catapults } from "./Catapults";
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

    if (cinema || shotMode || roster || saga || discover || countdown || defend || vs || xxx) {
      const sampleT = recT;
      const ctx = { cmdZ, form, castle, fit, castleFit, level };
      const pose = xxx
        ? sampleXxxCam(sampleT, ctx, xxx)
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
      if (defend || vs || xxx) {
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

function DayLights({ cinematic = false, slim = false }: { cinematic?: boolean; slim?: boolean }) {
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
      <ambientLight intensity={slim ? 0.72 : 0.42} color="#dce6f2" />
      <hemisphereLight args={["#9ec4f0", "#548a3c", slim ? 0.55 : 0.78]} />
      <directionalLight ref={sun} position={[-28, 42, 18]} intensity={slim ? 1.6 : 2.7} color="#fff4dc" />
      {!slim && <directionalLight position={[22, 14, 8]} intensity={0.55} color="#a8c4e8" />}
      {!slim && <directionalLight position={[6, 8, 56]} intensity={0.85} color="#ffe0b8" />}
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
  mix = null,
  xxx = null,
  rosterIds = null,
}: BattleSceneProps) {
  const chiefs = effectiveCommanders(commanders, names);
  const hideCmd = skipCommander || Boolean(discover) || Boolean(countdown) || Boolean(defend) || Boolean(vs) || Boolean(xxx && xxxHideCmd(xxx));
  const chiefN = hideCmd ? 0 : chiefs.length;
  const split = Boolean(mix);
  const sortie = isDefendSortie(defend);
  const field = isVs(vs);
  const climb = isVs2(vs);
  return (
    <>
      <color attach="background" args={["#7eb6ee"]} />
      <fog attach="fog" args={defend ? (sortie ? ["#9ec8ee", 600, 2200] : ["#9ec8ee", 1400, 4200]) : field ? ["#9ec8ee", 140, 720] : ["#9ec8ee", 380, 1500]} />
      <SkyDome cheap={Boolean(defend)} />
      <SteelSky />
      <DayLights cinematic={cinematic} slim={Boolean(defend)} />
      <Terrain road={!defend && !field} cheap={Boolean(defend)} />
      {!defend && !field && <Castle level={level} pressure={pressure} gateClosed={Boolean(countdown) || split || climb || Boolean(xxx)} wallFight={climb} />}
      {sortie && (
        <TimedVisible until={DEFEND2_SORTIE + 0.85}>
          <Castle level={level} pressure={pressure} forceGateOpen />
        </TimedVisible>
      )}
      {defend ? (
        <DefendRing soldiers={soldiers} mode={defend} level={level} />
      ) : field ? (
        <VsFoes soldiers={soldiers} />
      ) : (
        !roster && !split && !countdown && !vs && !xxx && <SallyRaid soldiers={soldiers} commanders={chiefN} />
      )}
      {climb && <VsLadders level={level} />}
      <Army count={soldiers} names={names} commanders={commanders} cinematic={cinematic} duration={duration} skipCommander={hideCmd} roster={roster} discover={discover} countdown={Boolean(countdown)} defend={Boolean(defend)} defend2={sortie} defend3={isDefend3(defend)} vs={field} vs2={climb} mix={split} mixSlow={isMix9(mix)} nameHunt={Boolean(xxx)} quiet={Boolean(xxx && xxxQuiet(xxx))} square={Boolean(xxx && xxxSquare(xxx))} level={level} rosterIds={rosterIds} />
      {Boolean(xxx && xxxSquare(xxx)) && <Catapults soldiers={soldiers} square />}
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
      {cinematic && !split && !countdown && !defend && !vs && !xxx && maxHp != null && hp != null && (
        <CaptureHpHud hp={hp} maxHp={maxHp} soldiers={soldiers} duration={duration ?? 8} skipCommander={hideCmd} cinema={cinema} roster={roster} discover={discover} />
      )}
      {cinematic && showTitles && !split && !vs && !xxx && (
        <ReelTitles soldiers={soldiers} duration={duration ?? 8} day={day} skipCommander={hideCmd} cinema={cinema} roster={roster} saga={saga} discover={discover} countdown={countdown} defend={defend} names={names} rosterIds={rosterIds} />
      )}
      {cinematic && xxx && xxxHasHook(xxx) && (
        <XxxHookHud variant={xxxAdHook(xxx) ? "ad" : xxxClearHook(xxx) ? "clear" : "banner"} instant={xxxInstantHook(xxx)} />
      )}
      {cinematic && !split && <ReelVignette />}
      {countdown && <CountdownFlash />}
      {cinematic && !discover && !countdown && !defend && !vs && !split && <ReelFade duration={duration ?? 8} />}
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
  mix = null,
  xxx = null,
  rosterIds = null,
  onReady,
}: BattleSceneProps) {
  const [active, setActive] = useState(() => typeof document === "undefined" || !document.hidden);
  const hideCmd = skipCommander || Boolean(discover) || Boolean(countdown) || Boolean(defend) || Boolean(vs) || Boolean(xxx && xxxHideCmd(xxx));

  useLayoutEffect(() => {
    if (cinematic && (mix || xxx)) {
      setSallyOrigin(SALLY_START_DELAY - 90);
      setSwordStart(80);
    } else if (cinematic && roster) {
      setSallyOrigin(80);
      setSwordStart(80);
    } else if (cinematic && (countdown || defend || vs)) {
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
  }, [cinematic, cinema, duration, hideCmd, roster, saga, discover, countdown, defend, vs, mix, xxx]);

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
        antialias: !defend,
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
        gl.toneMappingExposure = cinematic ? 1.16 : 1.22;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.enabled = !cinematic;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.setClearColor("#7eb6ee", 1);
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
        mix={mix}
        xxx={xxx}
        rosterIds={rosterIds}
      />
    </Canvas>
  );
}

export const BattleScene = memo(BattleSceneInner);

