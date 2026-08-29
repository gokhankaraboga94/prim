import { useMemo } from "react";
import * as THREE from "three";

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
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#7a746c";
    ctx.fillRect(0, 0, 256, 256);
    const cols = 8;
    const rows = 6;
    const bw = 256 / cols;
    const bh = 256 / rows;
    for (let y = 0; y < rows; y++) {
      const ox = (y % 2) * (bw * 0.5);
      for (let x = -1; x <= cols; x++) {
        const n = (x * 19 + y * 37 + 11) % 36;
        const r = 130 + n;
        const g = 124 + n * 0.7;
        const b = 112 + n * 0.45;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(x * bw + ox + 1, y * bh + 1, bw - 2, bh - 2);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(x * bw + ox + 1, y * bh + bh - 4, bw - 2, 3);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(3, 2);
    return tex;
  }, []);
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
    <mesh position={position} rotation={rotation} castShadow={false}>
      <boxGeometry args={args} />
      <meshLambertMaterial color={color} map={map ?? undefined} />
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
  return (
    <group position={position}>
      <Block args={[size, height, size]} position={[0, height / 2, 0]} color={STONE} map={map} />
      <Block args={[size + 0.28, 0.28, size + 0.28]} position={[0, top, 0]} color={STONE_3} map={map} />
      <Merlons count={4} width={size + 0.1} y={top + 0.4} z={size / 2 + 0.06} map={map} />
      <Merlons count={4} width={size + 0.1} y={top + 0.4} z={-(size / 2 + 0.06)} map={map} />
      <Merlons count={3} width={size - 0.2} y={top + 0.4} z={size / 2 + 0.06} axis="z" map={map} />
      <Merlons count={3} width={size - 0.2} y={top + 0.4} z={-(size / 2 + 0.06)} axis="z" map={map} />
      <mesh position={[0, height * 0.55, size / 2 + 0.02]}>
        <boxGeometry args={[0.22, 0.7, 0.08]} />
        <meshLambertMaterial color={STONE_DARK} />
      </mesh>
      <mesh position={[0.55, height * 0.38, size / 2 + 0.02]}>
        <boxGeometry args={[0.16, 0.42, 0.08]} />
        <meshLambertMaterial color={STONE_DARK} />
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
        <cylinderGeometry args={[radius, radius + 0.12, height, 10]} />
        <meshLambertMaterial color={STONE_2} map={map ?? undefined} />
      </mesh>
      <mesh position={[0, height + 0.08, 0]}>
        <cylinderGeometry args={[radius + 0.16, radius + 0.1, 0.22, 10]} />
        <meshLambertMaterial color={STONE_3} />
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

export function Castle({ level, pressure }: CastleProps) {
  const stone = useStoneTexture();
  const visualTier = ((level - 1) % 5) + 1;
  const scale = 1 + Math.min(0.35, (level - 1) * 0.02);
  const wallH = 3.15 + visualTier * 0.14;
  const fire = Math.min(1, pressure);
  const merlonCount = 9;

  return (
    <group position={[0, 0, 0]} scale={scale}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[15.4, 15.4]} />
        <meshLambertMaterial color="#6a6258" map={stone ?? undefined} />
      </mesh>

      <Block args={[15.2, wallH, 1.7]} position={[0, wallH / 2, -6.55]} color={STONE} map={stone} />
      <Block args={[5.35, wallH, 1.7]} position={[-4.55, wallH / 2, 6.55]} color={STONE} map={stone} />
      <Block args={[5.35, wallH, 1.7]} position={[4.55, wallH / 2, 6.55]} color={STONE} map={stone} />
      <Block args={[1.7, wallH, 15.2]} position={[-6.55, wallH / 2, 0]} color={STONE} map={stone} />
      <Block args={[1.7, wallH, 15.2]} position={[6.55, wallH / 2, 0]} color={STONE} map={stone} />

      <Merlons count={merlonCount} width={14.2} y={wallH + 0.32} z={-6.55} map={stone} />
      <group position={[-4.55, 0, 0]}>
        <Merlons count={4} width={4.6} y={wallH + 0.32} z={6.55} map={stone} />
      </group>
      <group position={[4.55, 0, 0]}>
        <Merlons count={4} width={4.6} y={wallH + 0.32} z={6.55} map={stone} />
      </group>
      <Merlons count={merlonCount} width={14} y={wallH + 0.32} z={-6.55} axis="z" map={stone} />
      <Merlons count={merlonCount} width={14} y={wallH + 0.32} z={6.55} axis="z" map={stone} />

      <Block args={[0.95, wallH, 0.95]} position={[-2.05, wallH / 2, 6.55]} color={STONE_2} map={stone} />
      <Block args={[0.95, wallH, 0.95]} position={[2.05, wallH / 2, 6.55]} color={STONE_2} map={stone} />
      <mesh position={[0, 2.35, 6.62]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.15, 0.32, 6, 14, Math.PI]} />
        <meshLambertMaterial color={STONE_3} map={stone ?? undefined} />
      </mesh>
      <mesh position={[0, 1.15, 6.72]}>
        <boxGeometry args={[1.7, 2.25, 0.18]} />
        <meshLambertMaterial color="#1a100c" emissive="#3a0808" emissiveIntensity={0.2 + fire * 0.7} />
      </mesh>
      <Block args={[0.18, 2.1, 0.12]} position={[-0.55, 1.15, 6.82]} color="#2a1a12" />
      <Block args={[0.18, 2.1, 0.12]} position={[0.55, 1.15, 6.82]} color="#2a1a12" />

      <mesh position={[-0.72, wallH * 0.62, 6.42]}>
        <boxGeometry args={[0.18, 0.55, 0.1]} />
        <meshLambertMaterial color={STONE_DARK} />
      </mesh>
      <mesh position={[0.72, wallH * 0.62, 6.42]}>
        <boxGeometry args={[0.18, 0.55, 0.1]} />
        <meshLambertMaterial color={STONE_DARK} />
      </mesh>
      <mesh position={[0, wallH * 0.72, -6.42]}>
        <boxGeometry args={[0.2, 0.62, 0.1]} />
        <meshLambertMaterial color={STONE_DARK} />
      </mesh>

      <SquareTower position={[-6.7, 0, -6.7]} height={6.2} size={2.55} map={stone} />
      <SquareTower position={[6.7, 0, -6.7]} height={6.4} size={2.7} map={stone} />
      <SquareTower position={[-6.7, 0, 6.7]} height={5.6} size={2.45} map={stone} />
      <SquareTower position={[6.7, 0, 6.7]} height={5.8} size={2.5} map={stone} />
      <RoundTower position={[-2.1, 0, -2.4]} height={7.1} radius={1.55} map={stone} />

      <group position={[1.1, 0, -1.15]}>
        <Block args={[4.6, 8.4, 4.2]} position={[0, 4.2, 0]} color={STONE} map={stone} />
        <Block args={[5, 0.32, 4.6]} position={[0, 8.5, 0]} color={STONE_3} map={stone} />
        <Merlons count={5} width={4.7} y={8.92} z={2.15} map={stone} />
        <Merlons count={5} width={4.7} y={8.92} z={-2.15} map={stone} />
        <Merlons count={4} width={4} y={8.92} z={2.15} axis="z" map={stone} />
        <Merlons count={4} width={4} y={8.92} z={-2.15} axis="z" map={stone} />
        <mesh position={[0, 5.1, 2.14]}>
          <boxGeometry args={[0.28, 0.9, 0.1]} />
          <meshLambertMaterial color={STONE_DARK} />
        </mesh>
        <mesh position={[-1.1, 3.4, 2.14]}>
          <boxGeometry args={[0.2, 0.55, 0.1]} />
          <meshLambertMaterial color={STONE_DARK} />
        </mesh>
        <mesh position={[1.15, 6.4, 2.14]}>
          <boxGeometry args={[0.2, 0.5, 0.1]} />
          <meshLambertMaterial color={STONE_DARK} />
        </mesh>
      </group>

      <mesh position={[-3.15, wallH + 1.05, 6.35]}>
        <boxGeometry args={[0.08, 2.1, 0.08]} />
        <meshLambertMaterial color="#3a2a18" />
      </mesh>
      <mesh position={[-2.85, wallH + 0.7, 6.35]}>
        <planeGeometry args={[0.85, 1.15]} />
        <meshLambertMaterial color="#6a1212" />
      </mesh>
      <mesh position={[3.15, wallH + 1.05, 6.35]}>
        <boxGeometry args={[0.08, 2.1, 0.08]} />
        <meshLambertMaterial color="#3a2a18" />
      </mesh>
      <mesh position={[3.45, wallH + 0.7, 6.35]}>
        <planeGeometry args={[0.85, 1.15]} />
        <meshLambertMaterial color="#6a1212" />
      </mesh>

      <pointLight position={[0, 2.4, 7.1]} color="#ff6a2a" intensity={0.55 + fire * 1.1} distance={12} />
    </group>
  );
}
