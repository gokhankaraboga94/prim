import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sallyGate, sallyLocal } from "../../siegeEvent";
import { castleAxes, castleGrow } from "../../castleLayout";
import { Defenders } from "./Defenders";

type CastleProps = {
  level: number;
  pressure: number;
};

const STONE = "#8a847c";
const STONE_2 = "#766f68";
const STONE_3 = "#9a948c";
const STONE_DARK = "#4a4642";

function useStoneTexture() {
  return useMemo(() => {
    const size = 2048;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#2e2a26";
    ctx.fillRect(0, 0, size, size);
    const cols = 14;
    const rows = 12;
    const bw = size / cols;
    const bh = size / rows;
    for (let y = 0; y < rows; y++) {
      const ox = (y % 2) * (bw * 0.5);
      for (let x = -1; x <= cols; x++) {
        const n = (x * 19 + y * 37 + 11) % 56;
        const r = 112 + n;
        const g = 102 + n * 0.52;
        const b = 90 + n * 0.3;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(x * bw + ox + 4, y * bh + 4, bw - 8, bh - 8);
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        ctx.fillRect(x * bw + ox + 4, y * bh + 4, bw - 8, 5);
        ctx.fillStyle = "rgba(0,0,0,0.38)";
        ctx.fillRect(x * bw + ox + 4, y * bh + bh - 10, bw - 8, 6);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillRect(x * bw + ox + bw - 10, y * bh + 4, 4, bh - 8);
        if ((x + y) % 3 === 0) {
          ctx.fillStyle = "rgba(28, 20, 14, 0.2)";
          ctx.fillRect(x * bw + ox + 14, y * bh + 12, bw * 0.4, bh * 0.42);
        }
      }
    }
    for (let i = 0; i < 480; i++) {
      ctx.fillStyle = "rgba(42, 72, 32, 0.16)";
      ctx.fillRect(Math.random() * size, Math.random() * size, 5 + Math.random() * 14, 2);
    }
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = `rgba(20,18,16,${0.08 + Math.random() * 0.14})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 2 + Math.random() * 18, 1);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 16;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(3.4, 2.2);
    return tex;
  }, []);
}

function Flame({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const f = 1 + Math.sin(t * 16 + position[0] * 5 + position[2]) * 0.2;
    if (mesh.current) mesh.current.scale.set(scale * (0.88 + f * 0.12), scale * f, scale * (0.88 + f * 0.12));
    if (mat.current) mat.current.opacity = 0.8 + Math.sin(t * 22 + position[2]) * 0.12;
  });
  return (
    <group position={position}>
      <mesh ref={mesh} position={[0, 0.22 * scale, 0]}>
        <coneGeometry args={[0.13, 0.46, 5]} />
        <meshBasicMaterial ref={mat} color="#ff7a28" transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, 0.08 * scale, 0]}>
        <coneGeometry args={[0.07, 0.2, 5]} />
        <meshBasicMaterial color="#ffe28a" transparent opacity={0.95} />
      </mesh>
    </group>
  );
}

function Block({
  args,
  position,
  color = STONE,
  map,
  rotation,
}: {
  args: [number, number, number];
  position: [number, number, number];
  color?: string;
  map?: THREE.Texture | null;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} map={map ?? undefined} roughness={0.74} metalness={0.12} envMapIntensity={0.55} />
    </mesh>
  );
}

function Merlons({
  count,
  width,
  y,
  z,
  axis = "x",
  map,
}: {
  count: number;
  width: number;
  y: number;
  z: number;
  axis?: "x" | "z";
  map?: THREE.Texture | null;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * (width - 0.45);
        const pos: [number, number, number] = axis === "x" ? [t, y, z] : [z, y, t];
        return <Block key={`${axis}-${i}`} args={[0.4, 0.58, 0.52]} position={pos} color={STONE_3} map={map} />;
      })}
    </>
  );
}

function SquareTower({
  position,
  height,
  size = 2.4,
  map,
}: {
  position: [number, number, number];
  height: number;
  size?: number;
  map?: THREE.Texture | null;
}) {
  const top = height + 0.12;
  const base = size + 0.55;
  return (
    <group position={position}>
      <Block args={[base, height * 0.22, base]} position={[0, height * 0.11, 0]} color={STONE_2} map={map} />
      <Block args={[size, height, size]} position={[0, height / 2, 0]} color={STONE} map={map} />
      <Block args={[size + 0.22, 0.7, size + 0.22]} position={[0, height * 0.62, 0]} color={STONE_2} map={map} />
      <Block args={[size + 0.36, 0.32, size + 0.36]} position={[0, top, 0]} color={STONE_3} map={map} />
      <Merlons count={5} width={size + 0.18} y={top + 0.45} z={size / 2 + 0.08} map={map} />
      <Merlons count={5} width={size + 0.18} y={top + 0.45} z={-(size / 2 + 0.08)} map={map} />
      <Merlons count={4} width={size} y={top + 0.45} z={size / 2 + 0.08} axis="z" map={map} />
      <Merlons count={4} width={size} y={top + 0.45} z={-(size / 2 + 0.08)} axis="z" map={map} />
      <mesh position={[0, height * 0.58, size / 2 + 0.03]}>
        <boxGeometry args={[0.24, 0.82, 0.1]} />
        <meshStandardMaterial color={STONE_DARK} />
      </mesh>
      <mesh position={[-0.55, height * 0.4, size / 2 + 0.03]}>
        <boxGeometry args={[0.16, 0.48, 0.08]} />
        <meshStandardMaterial color={STONE_DARK} />
      </mesh>
      <mesh position={[0.55, height * 0.34, size / 2 + 0.03]}>
        <boxGeometry args={[0.16, 0.42, 0.08]} />
        <meshStandardMaterial color={STONE_DARK} />
      </mesh>
    </group>
  );
}

function Gatehouse({
  wallH,
  stone,
}: {
  wallH: number;
  stone: THREE.Texture | null;
}) {
  const bars = useMemo(() => Array.from({ length: 7 }, (_, i) => i), []);
  const rails = useMemo(() => Array.from({ length: 4 }, (_, i) => i), []);
  const leftDoor = useRef<THREE.Group>(null);
  const rightDoor = useRef<THREE.Group>(null);
  const grate = useRef<THREE.Group>(null);

  useFrame((state) => {
    const open = sallyGate(sallyLocal(state.clock.elapsedTime));
    if (leftDoor.current) leftDoor.current.rotation.y = 0.12 + open * 1.35;
    if (rightDoor.current) rightDoor.current.rotation.y = -0.12 - open * 1.35;
    if (grate.current) grate.current.position.y = 1.35 + open * 2.35;
  });

  return (
    <group position={[0, 0, 6.85]}>
      <Block args={[1.7, wallH + 2.05, 3.15]} position={[-2.25, (wallH + 2.05) / 2, 0.2]} color={STONE} map={stone} />
      <Block args={[1.7, wallH + 2.05, 3.15]} position={[2.25, (wallH + 2.05) / 2, 0.2]} color={STONE} map={stone} />
      <Block args={[6.4, 1.55, 3.3]} position={[0, wallH + 1.35, 0.22]} color={STONE_2} map={stone} />
      <Block args={[6.8, 0.32, 3.55]} position={[0, wallH + 2.2, 0.26]} color={STONE_3} map={stone} />
      <Merlons count={6} width={6.2} y={wallH + 2.65} z={1.7} map={stone} />
      <Merlons count={6} width={6.2} y={wallH + 2.65} z={-1.15} map={stone} />

      <mesh position={[0, 2.55, 1.42]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.28, 0.26, 8, 18, Math.PI]} />
        <meshStandardMaterial color={STONE_3} map={stone ?? undefined} />
      </mesh>
      <Block args={[2.7, 0.32, 0.55]} position={[0, 2.52, 1.42]} color={STONE_2} map={stone} />

      <mesh position={[0, 1.2, -0.35]}>
        <boxGeometry args={[2.2, 2.4, 0.85]} />
        <meshStandardMaterial color="#0c0907" />
      </mesh>

      <group ref={leftDoor} position={[-1.14, 1.12, 1.28]}>
        <mesh position={[0.56, 0, 0]}>
          <boxGeometry args={[1.12, 2.2, 0.14]} />
          <meshStandardMaterial color="#4a2a14" />
        </mesh>
        {[ -0.15, 0.55].map((y) => (
          <mesh key={`lb-${y}`} position={[0.56, y, 0.08]}>
            <boxGeometry args={[1.05, 0.07, 0.04]} />
            <meshStandardMaterial color="#2a2c30" />
          </mesh>
        ))}
      </group>
      <group ref={rightDoor} position={[1.14, 1.12, 1.28]}>
        <mesh position={[-0.56, 0, 0]}>
          <boxGeometry args={[1.12, 2.2, 0.14]} />
          <meshStandardMaterial color="#3f2412" />
        </mesh>
        {[-0.15, 0.55].map((y) => (
          <mesh key={`rb-${y}`} position={[-0.56, y, 0.08]}>
            <boxGeometry args={[1.05, 0.07, 0.04]} />
            <meshStandardMaterial color="#2a2c30" />
          </mesh>
        ))}
      </group>

      <group ref={grate} position={[0, 1.35, 1.18]}>
        {bars.map((i) => (
          <mesh key={`v-${i}`} position={[-1.05 + i * 0.35, 0, 0]}>
            <boxGeometry args={[0.055, 2.35, 0.055]} />
            <meshStandardMaterial color="#2c3034" />
          </mesh>
        ))}
        {rails.map((i) => (
          <mesh key={`h-${i}`} position={[0, -0.85 + i * 0.55, 0]}>
            <boxGeometry args={[2.2, 0.05, 0.05]} />
            <meshStandardMaterial color="#35383c" />
          </mesh>
        ))}
      </group>

      <Flame position={[-1.55, wallH * 0.72, 1.62]} scale={0.72} />
      <Flame position={[1.55, wallH * 0.72, 1.62]} scale={0.72} />
      <mesh position={[-1.55, wallH * 0.72, 1.48]}>
        <boxGeometry args={[0.16, 0.5, 0.1]} />
        <meshStandardMaterial color={STONE_DARK} />
      </mesh>
      <mesh position={[1.55, wallH * 0.72, 1.48]}>
        <boxGeometry args={[0.16, 0.5, 0.1]} />
        <meshStandardMaterial color={STONE_DARK} />
      </mesh>
    </group>
  );
}

function RoundTower({
  position,
  height,
  radius = 1.45,
  map,
}: {
  position: [number, number, number];
  height: number;
  radius?: number;
  map?: THREE.Texture | null;
}) {
  const merlonN = 10;
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[radius, radius + 0.12, height, 16]} />
        <meshStandardMaterial color={STONE_2} map={map ?? undefined} />
      </mesh>
      <mesh position={[0, height + 0.08, 0]}>
        <cylinderGeometry args={[radius + 0.16, radius + 0.1, 0.22, 10]} />
        <meshStandardMaterial color={STONE_3} />
      </mesh>
      {Array.from({ length: merlonN }, (_, i) => {
        const a = (i / merlonN) * Math.PI * 2;
        return (
          <Block
            key={i}
            args={[0.32, 0.5, 0.28]}
            position={[Math.sin(a) * (radius + 0.08), height + 0.42, Math.cos(a) * (radius + 0.08)]}
            color={STONE_3}
          />
        );
      })}
    </group>
  );
}

export function Castle({ level }: CastleProps) {
  const stone = useStoneTexture();
  const visualTier = ((level - 1) % 5) + 1;
  const grow = castleGrow(level);
  const { sx, sy, sz, zShift } = castleAxes(grow);
  const wallH = 3.85 + visualTier * 0.18;
  const merlonCount = 13;

  return (
    <group>
    <group position={[0, 0, zShift]} scale={[sx, sy, sz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -4.05]} receiveShadow>
        <planeGeometry args={[21.6, 18.2]} />
        <meshStandardMaterial color="#6a6258" map={stone ?? undefined} roughness={0.9} />
      </mesh>

      <Block args={[24.4, wallH, 2.15]} position={[0, wallH / 2, -13.2]} color={STONE} map={stone} />
      <Block args={[9.4, wallH, 2.15]} position={[-6.7, wallH / 2, 6.55]} color={STONE} map={stone} />
      <Block args={[9.4, wallH, 2.15]} position={[6.7, wallH / 2, 6.55]} color={STONE} map={stone} />
      <Block args={[2.15, wallH, 21.6]} position={[-10.85, wallH / 2, -3.325]} color={STONE} map={stone} />
      <Block args={[2.15, wallH, 21.6]} position={[10.85, wallH / 2, -3.325]} color={STONE} map={stone} />
      <Block args={[21.6, 0.22, 0.85]} position={[0, wallH - 0.05, -12.35]} color={STONE_3} map={stone} />
      <Block args={[8.2, 0.22, 0.85]} position={[-6.7, wallH - 0.05, 5.7]} color={STONE_3} map={stone} />
      <Block args={[8.2, 0.22, 0.85]} position={[6.7, wallH - 0.05, 5.7]} color={STONE_3} map={stone} />
      <Block args={[0.85, 0.22, 19.6]} position={[-10.05, wallH - 0.05, -3.325]} color={STONE_3} map={stone} />
      <Block args={[0.85, 0.22, 19.6]} position={[10.05, wallH - 0.05, -3.325]} color={STONE_3} map={stone} />

      <Merlons count={merlonCount} width={23.2} y={wallH + 0.36} z={-13.2} map={stone} />
      <group position={[-6.7, 0, 0]}>
        <Merlons count={6} width={8.6} y={wallH + 0.36} z={6.55} map={stone} />
      </group>
      <group position={[6.7, 0, 0]}>
        <Merlons count={6} width={8.6} y={wallH + 0.36} z={6.55} map={stone} />
      </group>
      <group position={[0, 0, -3.3]}>
        <Merlons count={15} width={20.8} y={wallH + 0.36} z={-10.85} axis="z" map={stone} />
        <Merlons count={15} width={20.8} y={wallH + 0.36} z={10.85} axis="z" map={stone} />
      </group>

      <Gatehouse wallH={wallH} stone={stone} />
      <mesh position={[0, wallH * 0.72, -13.05]}>
        <boxGeometry args={[0.2, 0.62, 0.1]} />
        <meshStandardMaterial color={STONE_DARK} />
      </mesh>

      <Block args={[1.15, wallH * 0.72, 1.15]} position={[-7.2, wallH * 0.36, 4.1]} color={STONE_2} map={stone} />
      <Block args={[1.15, wallH * 0.72, 1.15]} position={[7.2, wallH * 0.36, 4.1]} color={STONE_2} map={stone} />
      <Block args={[1.15, wallH * 0.72, 1.15]} position={[-7.2, wallH * 0.36, -10.4]} color={STONE_2} map={stone} />
      <Block args={[1.15, wallH * 0.72, 1.15]} position={[7.2, wallH * 0.36, -10.4]} color={STONE_2} map={stone} />

      <SquareTower position={[-11.1, 0, -13.6]} height={8.6} size={3.25} map={stone} />
      <SquareTower position={[11.1, 0, -13.6]} height={8.9} size={3.4} map={stone} />
      <SquareTower position={[-11.1, 0, 6.85]} height={8} size={3.1} map={stone} />
      <SquareTower position={[11.1, 0, 6.85]} height={8.2} size={3.15} map={stone} />
      <SquareTower position={[0, 0, -13.6]} height={6.4} size={2.35} map={stone} />
      <Flame position={[-11.1, 8.15, 6.85]} scale={1.35} />
      <Flame position={[11.1, 8.35, 6.85]} scale={1.35} />
      <Flame position={[-11.1, 8.75, -13.6]} scale={1.15} />
      <Flame position={[11.1, 9.05, -13.6]} scale={1.15} />
      <Flame position={[-2.4, 9.1, -2.6]} scale={0.95} />
      <Flame position={[1.2, 13.4, -1.2]} scale={1.25} />
      <RoundTower position={[-2.4, 0, -2.6]} height={9.6} radius={1.85} map={stone} />
      <RoundTower position={[4.8, 0, -8.8]} height={7.4} radius={1.5} map={stone} />
      <RoundTower position={[-5.6, 0, -8.4]} height={6.8} radius={1.25} map={stone} />

      <group position={[1.2, 0, -1.2]}>
        <Block args={[6.4, 12.4, 5.8]} position={[0, 6.2, 0]} color={STONE} map={stone} />
        <Block args={[7, 0.42, 6.4]} position={[0, 12.55, 0]} color={STONE_3} map={stone} />
        <Block args={[4.2, 2.8, 3.8]} position={[0, 13.95, 0]} color={STONE_2} map={stone} />
        <mesh position={[0, 16.1, 0]}>
          <coneGeometry args={[2.55, 2.4, 8]} />
          <meshStandardMaterial color="#5c2a22" roughness={0.78} />
        </mesh>
        <Merlons count={6} width={6.2} y={12.95} z={2.95} map={stone} />
        <Merlons count={6} width={6.2} y={12.95} z={-2.95} map={stone} />
        <Merlons count={5} width={5.4} y={12.95} z={2.95} axis="z" map={stone} />
        <Merlons count={5} width={5.4} y={12.95} z={-2.95} axis="z" map={stone} />
        <mesh position={[0, 6.4, 2.95]}>
          <boxGeometry args={[0.38, 1.15, 0.12]} />
          <meshStandardMaterial color="#1a1612" emissive="#ffb060" emissiveIntensity={0.28} roughness={0.7} />
        </mesh>
        <mesh position={[-1.45, 4.1, 2.95]}>
          <boxGeometry args={[0.24, 0.65, 0.1]} />
          <meshStandardMaterial color="#1a1612" emissive="#ff9a40" emissiveIntensity={0.18} roughness={0.7} />
        </mesh>
        <mesh position={[1.5, 8.1, 2.95]}>
          <boxGeometry args={[0.24, 0.6, 0.1]} />
          <meshStandardMaterial color="#1a1612" emissive="#ffb060" emissiveIntensity={0.2} roughness={0.7} />
        </mesh>
        <mesh position={[-1.6, 9.8, 2.95]}>
          <boxGeometry args={[0.2, 0.48, 0.1]} />
          <meshStandardMaterial color="#1a1612" emissive="#ff9a40" emissiveIntensity={0.16} roughness={0.7} />
        </mesh>
      </group>
      <Block args={[4.6, 3.4, 3.8]} position={[-5.2, 1.7, -5.4]} color={STONE_2} map={stone} />
      <Block args={[5, 0.22, 4.2]} position={[-5.2, 3.45, -5.4]} color={STONE_3} map={stone} />
      <mesh position={[-5.2, 4.55, -5.4]} rotation={[0, 0.2, 0]}>
        <coneGeometry args={[2.6, 1.8, 4]} />
        <meshStandardMaterial color="#6a3226" roughness={0.8} />
      </mesh>

      <mesh position={[-5.4, wallH + 1.05, 6.35]}>
        <boxGeometry args={[0.08, 2.1, 0.08]} />
        <meshStandardMaterial color="#3a2a18" />
      </mesh>
      <mesh position={[-5.1, wallH + 0.7, 6.35]}>
        <planeGeometry args={[0.85, 1.15]} />
        <meshStandardMaterial color="#6a1212" />
      </mesh>
      <mesh position={[5.4, wallH + 1.05, 6.35]}>
        <boxGeometry args={[0.08, 2.1, 0.08]} />
        <meshStandardMaterial color="#3a2a18" />
      </mesh>
      <mesh position={[5.7, wallH + 0.7, 6.35]}>
        <planeGeometry args={[0.85, 1.15]} />
        <meshStandardMaterial color="#6a1212" />
      </mesh>

      <pointLight position={[-11.1, 8.2, 6.85]} color="#ff7a30" intensity={0.65} distance={14} />
      <pointLight position={[11.1, 8.4, 6.85]} color="#ff7a30" intensity={0.65} distance={14} />
      <pointLight position={[1.2, 14.2, -1.2]} color="#ff8a40" intensity={0.45} distance={16} />
    </group>
    <Defenders grow={grow} wallH={wallH} />
    </group>
  );
}
