import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Army, armyFrame } from "./Army";
import { Castle } from "./Castle";
import { SallyRaid } from "./SallyRaid";
import { CaptureHpHud, ReelFade, ReelTitles, ReelVignette } from "./CaptureHpHud";
import { castleFrame } from "../../castleLayout";
import { REEL_HOLD, reelBeats } from "../../recordCanvas";
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
  skipCommander = false,
}: {
  duration: number;
  soldiers: number;
  level: number;
  commanders?: number;
  skipCommander?: boolean;
}) {
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, clock, size }) => {
    const aspect = size.width / Math.max(1, size.height);
    const recT = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const { cmd, turn, pullStart } = reelBeats(duration, skipCommander);

    const form = armyFrame(soldiers, commanders);
    const castle = castleFrame(level);
    const swing = swordSwingU(sallyLocal(clock.elapsedTime), Math.max(1, commanders));
    const smash = swing > 0.22 ? Math.sin(((swing - 0.22) / 0.78) * Math.PI) : 0;
    const shake = smash * (recT < cmd + 0.35 ? 0.11 : 0.04);

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
      x: castle.width * 0.04,
      y: castle.midY + 32 + castleFit * 0.12,
      z: castle.midZ + castleFit * 0.78,
      lx: 0,
      ly: castle.midY * 0.55,
      lz: castle.midZ,
      fov: 40,
    };

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
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#357028";
    ctx.fillRect(0, 0, 2048, 2048);
    for (let i = 0; i < 28000; i++) {
      const n = i % 7;
      ctx.fillStyle =
        n === 0 ? "#6fbf4a" : n === 1 ? "#2e6a24" : n === 2 ? "#57a83c" : n === 3 ? "#24581c" : n === 4 ? "#8fd45c" : n === 5 ? "#4a8a34" : "#1e4a18";
      ctx.fillRect(Math.random() * 2048, Math.random() * 2048, 2 + Math.random() * 9, 2 + Math.random() * 8);
    }
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = "rgba(92, 68, 36, 0.24)";
      ctx.beginPath();
      ctx.ellipse(Math.random() * 2048, Math.random() * 2048, 12 + Math.random() * 34, 7 + Math.random() * 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = "rgba(20, 40, 14, 0.18)";
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[720, 720]} />
        <meshStandardMaterial map={ground} color="#4e963c" roughness={0.92} envMapIntensity={0.2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 13]} receiveShadow>
        <planeGeometry args={[9.2, 32]} />
        <meshStandardMaterial color="#a8824c" roughness={0.88} />
      </mesh>
      <instancedMesh ref={rocks} args={[undefined, undefined, 24]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.9, 1]} />
        <meshStandardMaterial color="#7a7468" roughness={0.92} />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, 22]} castShadow>
        <cylinderGeometry args={[0.22, 0.32, 1.5, 8]} />
        <meshStandardMaterial color="#4a2e1a" roughness={0.88} />
      </instancedMesh>
      <instancedMesh ref={canopy} args={[undefined, undefined, 22]} castShadow>
        <sphereGeometry args={[1.15, 10, 8]} />
        <meshStandardMaterial color="#2a7a32" roughness={0.78} />
      </instancedMesh>
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

function DayLights({ cinematic = false }: { cinematic?: boolean }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  useLayoutEffect(() => {
    const light = sun.current;
    if (!light) return;
    light.castShadow = cinematic;
    light.shadow.mapSize.set(2048, 2048);
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
      <ambientLight intensity={0.42} color="#dce6f2" />
      <hemisphereLight args={["#9ec4f0", "#3d6a30", 0.78]} />
      <directionalLight ref={sun} position={[-28, 42, 18]} intensity={2.7} color="#fff4dc" />
      <directionalLight position={[22, 14, 8]} intensity={0.55} color="#a8c4e8" />
      <directionalLight position={[6, 8, 56]} intensity={0.85} color="#ffe0b8" />
    </>
  );
}

function Embers() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(() => Float32Array.from({ length: 90 }, () => Math.random()), []);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < 90; i++) {
      const s = seeds[i];
      const life = (t * (0.35 + s * 0.45) + s * 8) % 3.2;
      const u = life / 3.2;
      dummy.position.set((s - 0.5) * 6.5 + Math.sin(t * 1.4 + i) * 0.4, 1.1 + u * 7.2, 16.2 + (s * 3 - 1.2));
      const sc = 0.04 + (1 - u) * 0.07;
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 90]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 5]} />
      <meshBasicMaterial color="#ffb060" toneMapped={false} transparent opacity={0.85} />
    </instancedMesh>
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
  skipCommander = false,
}: BattleSceneProps) {
  return (
    <>
      <color attach="background" args={["#7eb6ee"]} />
      <fog attach="fog" args={["#9ec8ee", 380, 1500]} />
      <SkyDome />
      <SteelSky />
      <DayLights cinematic={cinematic} />
      <Terrain />
      {cinematic && <Embers />}
      <Castle level={level} pressure={pressure} />
      <SallyRaid soldiers={soldiers} commanders={commanders.length} />
      <Army count={soldiers} names={names} commanders={commanders} cinematic={cinematic} duration={duration} skipCommander={skipCommander} />
      {cinematic ? (
        <CinematicCam
          duration={duration ?? 8}
          soldiers={soldiers}
          level={level}
          commanders={commanders.length}
          skipCommander={skipCommander}
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
      {cinematic && maxHp != null && hp != null && (
        <CaptureHpHud hp={hp} maxHp={maxHp} soldiers={soldiers} duration={duration ?? 8} skipCommander={skipCommander} />
      )}
      {cinematic && showTitles && (
        <ReelTitles soldiers={soldiers} duration={duration ?? 8} day={day} skipCommander={skipCommander} />
      )}
      {cinematic && <ReelVignette />}
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
  skipCommander = false,
  onReady,
}: BattleSceneProps) {
  const [active, setActive] = useState(() => typeof document === "undefined" || !document.hidden);

  useLayoutEffect(() => {
    if (cinematic) {
      const beats = reelBeats(duration ?? 8, skipCommander);
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
  }, [cinematic, duration, skipCommander]);

  useEffect(() => {
    const onVis = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <Canvas
      shadows
      dpr={cinematic ? 1.25 : [1, 1.5]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
        preserveDrawingBuffer: Boolean(cinematic),
        failIfMajorPerformanceCaveat: false,
      }}
      camera={{ fov: 36, near: 0.12, far: 3200, position: cinematic ? [12, 11, 74] : [9, 21, 96] }}
      frameloop={active ? "always" : "demand"}
      style={{ width: "100%", height: "100%", display: "block" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = cinematic ? 1.16 : 1.22;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.setClearColor("#7eb6ee", 1);
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
        skipCommander={skipCommander}
      />
    </Canvas>
  );
}

export const BattleScene = memo(BattleSceneInner);

