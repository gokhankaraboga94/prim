import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { fitHero } from "./ArenaBattle";
import { REEL_HOLD } from "../../recordCanvas";
import { LOOP_HERO, LOOP_SECONDS, LOOP_SPOTS, loopCam } from "../../loopReel";

const STONE = "#8b847c";
const STONE_DARK = "#5e5954";
const FLOOR = "#7a7168";
const GRASS = "#6a9a48";

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

function Merlons({ axis, at, from, to, n }: { axis: "x" | "z"; at: number; from: number; to: number; n: number }) {
  const nodes = [];
  for (let i = 0; i < n; i++) {
    const t = from + ((to - from) * i) / Math.max(1, n - 1);
    const position: [number, number, number] = axis === "x" ? [t, 3.72, at] : [at, 3.72, t];
    const args: [number, number, number] = axis === "x" ? [0.46, 0.5, 0.62] : [0.62, 0.5, 0.46];
    nodes.push(<Block key={`${axis}:${i}`} args={args} position={position} color="#9a948c" />);
  }
  return <group>{nodes}</group>;
}

function Torch({ position }: { position: [number, number, number] }) {
  const flame = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const u = (t / LOOP_SECONDS) * Math.PI * 2;
    const f = 1 + Math.sin(u * 3 + position[0]) * 0.14;
    if (flame.current) flame.current.scale.set(0.9 + f * 0.1, f, 0.9 + f * 0.1);
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.7, 6]} />
        <meshLambertMaterial color="#3a2a16" />
      </mesh>
      <mesh ref={flame} position={[0, 0.85, 0]}>
        <coneGeometry args={[0.12, 0.38, 6]} />
        <meshBasicMaterial color="#ff8a2a" />
      </mesh>
    </group>
  );
}

function Banner() {
  const cloth = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const u = (t / LOOP_SECONDS) * Math.PI * 2;
    if (cloth.current) cloth.current.rotation.y = Math.sin(u * 2) * 0.08;
  });
  return (
    <group position={[3.15, 0, 2.35]}>
      <mesh position={[0, 1.15, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 2.3, 6]} />
        <meshLambertMaterial color="#3a2a16" />
      </mesh>
      <mesh ref={cloth} position={[0.38, 1.85, 0]}>
        <boxGeometry args={[0.7, 0.48, 0.03]} />
        <meshLambertMaterial color="#8e2a22" />
      </mesh>
    </group>
  );
}

function Yard() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <circleGeometry args={[22, 40]} />
        <meshLambertMaterial color={GRASS} />
      </mesh>
      <Block args={[9.4, 0.1, 9.4]} position={[0, 0.02, 0]} color={FLOOR} />
      <Block args={[9.6, 3.4, 0.62]} position={[0, 1.7, -4.35]} color={STONE} />
      <Block args={[9.6, 3.4, 0.62]} position={[0, 1.7, 4.35]} color={STONE} />
      <Block args={[0.62, 3.4, 9.6]} position={[-4.35, 1.7, 0]} color={STONE} />
      <Block args={[0.62, 3.4, 9.6]} position={[4.35, 1.7, 0]} color={STONE} />
      <Block args={[8.4, 0.22, 1.05]} position={[0, 1.61, -3.72]} color={STONE_DARK} />
      <Merlons axis="x" at={-4.35} from={-4.2} to={4.2} n={11} />
      <Merlons axis="x" at={4.35} from={-4.2} to={4.2} n={11} />
      <Merlons axis="z" at={-4.35} from={-3.8} to={3.8} n={9} />
      <Merlons axis="z" at={4.35} from={-3.8} to={3.8} n={9} />
      {[
        [-4.35, -4.35],
        [4.35, -4.35],
        [-4.35, 4.35],
        [4.35, 4.35],
      ].map(([x, z]) => (
        <Block key={`${x}:${z}`} args={[1.7, 5.4, 1.7]} position={[x, 2.7, z]} color={STONE_DARK} />
      ))}
      <Block args={[0.7, 0.55, 0.7]} position={[-1.7, 0.32, 0.35]} color="#6a5340" />
      <Block args={[0.55, 0.7, 0.55]} position={[-1.35, 0.4, 0.7]} color="#5c4636" />
      <Block args={[1.15, 1.85, 0.72]} position={[-3.45, 0.92, -2.55]} color="#4e4944" />
      <Block args={[0.7, 1.7, 0.55]} position={[2.72, 0.85, 0.35]} color="#4a453f" />
      <Torch position={[-3.55, 0, 3.15]} />
      <Torch position={[3.55, 0, -2.4]} />
      <Banner />
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
      mat.color.multiplyScalar(0.28);
      mesh.material = mat;
    });
    return copy;
  }, [src, spot.hard]);
  const ref = useRef<THREE.Group>(null);
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
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const turn = Math.sin((t / LOOP_SECONDS) * Math.PI * 2 + index * 0.7) * (spot.hard ? 0.03 : 0.09);
    if (ref.current) ref.current.rotation.y = spot.yaw + turn;
  });
  return (
    <group ref={ref} position={[spot.x, spot.y, spot.z]} scale={1.42}>
      <primitive object={model} />
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
        if (mat.color) mat.color.multiplyScalar(1.65);
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
      <mesh position={[0, size.height * 0.4, 5]} renderOrder={40}>
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
      <ambientLight intensity={0.72} color="#ffe6cc" />
      <directionalLight position={[14, 18, 12]} intensity={2.5} color="#ffc27a" />
      <directionalLight position={[6, 9, 14]} intensity={0.35} color="#d5e4f8" />
      <Yard />
      <Heroes />
      <LoopCard />
    </group>
  );
}
