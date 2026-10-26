import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { fitHero } from "./ArenaBattle";
import { REEL_HOLD } from "../../recordCanvas";
import { LOOP_FACE, LOOP_HERO, LOOP_SECONDS, LOOP_SPOTS, loopCam } from "../../loopReel";

const WARM = ["#ff5a36", "#ffd54f", "#ff4d8d", "#22c55e", "#ff8a2a", "#ffe14a"] as const;

function loopPhase(clock: { elapsedTime: number }) {
  const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
  return (t / LOOP_SECONDS) * Math.PI * 2;
}

function Block({
  args,
  position,
  color,
  rotation,
}: {
  args: [number, number, number];
  position: [number, number, number];
  color: string;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow={false} receiveShadow>
      <boxGeometry args={args} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

function plazaMap() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.fillStyle = "#f6c14a";
  ctx.fillRect(0, 0, 1024, 1024);
  const step = 128;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#ff5a36" : "#ffe7a3";
      ctx.beginPath();
      ctx.moveTo((x + 0.5) * step, y * step);
      ctx.lineTo((x + 1) * step, (y + 0.5) * step);
      ctx.lineTo((x + 0.5) * step, (y + 1) * step);
      ctx.lineTo(x * step, (y + 0.5) * step);
      ctx.fill();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(8, 10);
  map.anisotropy = 8;
  return map;
}

function Canopy({
  position,
  color,
  width,
}: {
  position: [number, number, number];
  color: string;
  width: number;
}) {
  const cloth = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const w = loopPhase(clock);
    if (cloth.current) cloth.current.rotation.z = Math.sin(w * 2 + position[0]) * 0.08;
  });
  return (
    <group position={position}>
      <mesh position={[-width * 0.42, 1.25, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 2.5, 6]} />
        <meshLambertMaterial color="#3a2412" />
      </mesh>
      <mesh position={[width * 0.42, 1.25, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 2.5, 6]} />
        <meshLambertMaterial color="#3a2412" />
      </mesh>
      <group ref={cloth} position={[0, 2.55, 0]}>
        <mesh>
          <boxGeometry args={[width, 0.14, 1.55]} />
          <meshLambertMaterial color={color} />
        </mesh>
        <mesh position={[0, -0.22, 0.72]}>
          <boxGeometry args={[width, 0.36, 0.08]} />
          <meshLambertMaterial color="#fff6d8" />
        </mesh>
      </group>
    </group>
  );
}

function Bunting() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const w = loopPhase(clock);
    const group = ref.current;
    if (!group) return;
    group.children.forEach((child, i) => {
      child.rotation.z = Math.sin(w * 2 + i * 0.7) * 0.38;
    });
  });
  return (
    <group ref={ref} position={[0, 4.35, -2.6]}>
      {WARM.map((color, i) => (
        <group key={color + i} position={[-3.6 + i * 1.44, 0, (i % 2) * 0.25]}>
          <mesh position={[0, -0.28, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.32, 0.62, 3]} />
            <meshLambertMaterial color={color} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Stall({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <Block args={[1.25, 0.5, 0.62]} position={[0, 0.25, 0]} color="#fff1cc" />
      <Block args={[1.35, 0.12, 0.7]} position={[0, 0.52, 0]} color={color} />
    </group>
  );
}

function Flowers() {
  const spots = [
    [-1.7, 3.1],
    [1.1, 3.35],
    [3.2, 2.4],
    [-3.4, 2.2],
    [-5.2, -0.4],
    [5.1, 0.2],
    [0.2, -4.3],
    [-2.2, -3.6],
    [3.6, -3.4],
    [4.4, 3.0],
  ] as const;
  return (
    <group>
      {spots.map(([x, z], i) => (
        <mesh key={`${x}:${z}`} position={[x, 0.14, z]}>
          <sphereGeometry args={[0.16 + (i % 3) * 0.04, 8, 6]} />
          <meshLambertMaterial color={WARM[i % WARM.length]} />
        </mesh>
      ))}
    </group>
  );
}

function Pole({ position }: { position: [number, number, number] }) {
  const bands = ["#ff5a36", "#ffd54f", "#ff4d8d", "#22c55e"];
  return (
    <group position={position}>
      {bands.map((color, i) => (
        <mesh key={color} position={[0, 0.45 + i * 0.7, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.7, 8]} />
          <meshLambertMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function Yard() {
  const map = useMemo(plazaMap, []);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, -0.4]} receiveShadow>
        <circleGeometry args={[28, 48]} />
        <meshLambertMaterial color="#1fbf58" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 1.4]} receiveShadow>
        <planeGeometry args={[26, 30]} />
        <meshLambertMaterial map={map} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0.85]}>
        <circleGeometry args={[1.9, 40]} />
        <meshLambertMaterial color="#e23b4a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0.85]}>
        <ringGeometry args={[1.2, 1.42, 40]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0.85]}>
        <circleGeometry args={[1.08, 32]} />
        <meshLambertMaterial color="#ffd54f" />
      </mesh>
      <Canopy position={[-4.6, 0, -3.6]} color="#ff4d8d" width={3.1} />
      <Canopy position={[4.5, 0, -3.7]} color="#22c55e" width={3.1} />
      <Canopy position={[0.1, 0, -5.1]} color="#ffb300" width={4.2} />
      <Canopy position={[-5.4, 0, 1.4]} color="#ff5a36" width={2.4} />
      <Canopy position={[5.5, 0, 1.6]} color="#ffd54f" width={2.4} />
      <Stall position={[-3.9, 0, 0.35]} color="#ff4d8d" />
      <Stall position={[3.05, 0, -2.05]} color="#22c55e" />
      <Pole position={[-3.35, 0, 3.15]} />
      <Pole position={[3.45, 0, 3.25]} />
      <Bunting />
      <Flowers />
      <Block args={[1.1, 2.4, 0.18]} position={[-2.4, 1.2, -4.7]} color="#ff5a36" />
      <Block args={[1.1, 2.4, 0.18]} position={[2.5, 1.2, -4.7]} color="#ffd54f" />
      <Block args={[1.4, 2.8, 0.18]} position={[0.05, 1.4, -5.6]} color="#ff4d8d" />
    </group>
  );
}

function Sentry({ src, index }: { src: THREE.Group; index: number }) {
  const spot = LOOP_SPOTS[index];
  const model = useMemo(() => {
    const copy = src.clone(true);
    if (!spot.hard) return copy;
    copy.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = (mesh.material as THREE.MeshLambertMaterial).clone();
      mat.color.multiplyScalar(0.48);
      mesh.material = mat;
    });
    return copy;
  }, [src, spot.hard]);
  const root = useRef<THREE.Group>(null);
  const hip = useRef<THREE.Group>(null);
  useEffect(() => {
    if (!spot.hard) return;
    return () => {
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        (mesh.material as THREE.Material).dispose();
      });
    };
  }, [model, spot.hard]);
  useFrame(({ clock }) => {
    const w = loopPhase(clock);
    const phase = index * 0.95;
    const amp = spot.hard ? 0.4 : 1;
    if (root.current) root.current.rotation.y = spot.yaw + LOOP_FACE + Math.sin(w + phase) * 0.07 * amp;
    if (hip.current) {
      hip.current.rotation.z = Math.sin(w * 2 + phase) * 0.2 * amp;
      hip.current.position.y = Math.abs(Math.sin(w * 2 + phase)) * 0.11 * spot.scale * amp;
    }
  });
  return (
    <group ref={root} position={[spot.x, spot.y, spot.z]}>
      <group ref={hip}>
        <group scale={spot.scale}>
          <primitive object={model} />
        </group>
      </group>
    </group>
  );
}

function Heroes() {
  const [src, setSrc] = useState<THREE.Group | null>(null);
  const keep = useRef<THREE.Group | null>(null);
  useEffect(() => {
    let drop = false;
    new GLTFLoader().load(LOOP_HERO, (gltf) => {
      if (drop) return;
      const fitted = fitHero(gltf.scene, 0, true, false);
      fitted.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshLambertMaterial;
        if (mat.color) mat.color.multiplyScalar(1.25);
      });
      keep.current = fitted;
      setSrc(fitted);
    });
    return () => {
      drop = true;
      keep.current?.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
      });
      keep.current = null;
    };
  }, []);
  if (!src) return null;
  return (
    <group>
      {LOOP_SPOTS.map((_, index) => (
        <Sentry key={index} src={src} index={index} />
      ))}
    </group>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawLoopCard(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, 24, 16, w - 48, h - 32, 34);
  ctx.fillStyle = "#ffd54f";
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#111111";
  ctx.stroke();
  const line = "8 ASKERİ BUL!";
  let size = 128;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#111111";
  ctx.font = `900 ${size}px Inter, Montserrat, Helvetica, Arial, sans-serif`;
  while (size > 60 && ctx.measureText(line).width > w - 140) {
    size -= 4;
    ctx.font = `900 ${size}px Inter, Montserrat, Helvetica, Arial, sans-serif`;
  }
  ctx.fillText(line, w / 2, h / 2 + 4);
}

function LoopCard() {
  const size = useThree((s) => s.size);
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 280;
    drawLoopCard(canvas);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.generateMipmaps = false;
    map.minFilter = THREE.LinearFilter;
    map.magFilter = THREE.LinearFilter;
    return map;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  const w = size.width * 0.72;
  const h = w * (280 / 1080);
  return (
    <Hud renderPriority={1}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh position={[0, size.height * 0.26, 5]} renderOrder={40}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
      </mesh>
    </Hud>
  );
}

export function LoopCam() {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera, clock }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = loopCam(Math.max(0, clock.elapsedTime - REEL_HOLD));
    persp.fov = shot.fov;
    persp.near = 0.2;
    persp.far = 180;
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

export function LoopBattle() {
  return (
    <group>
      <ambientLight intensity={1.05} color="#fff4e4" />
      <directionalLight position={[2, 10, 14]} intensity={2.35} color="#fff1d0" />
      <directionalLight position={[-4, 6, 5]} intensity={0.4} color="#ffd0c8" />
      <Yard />
      <Heroes />
      <LoopCard />
    </group>
  );
}
