import { useMemo } from "react";

type CastleProps = {
  level: number;
  pressure: number;
};

function Stone({
  args,
  position,
  color = "#b7a48a",
}: {
  args: [number, number, number];
  position: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={args} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

export function Castle({ level, pressure }: CastleProps) {
  const visualTier = ((level - 1) % 5) + 1;
  const scale = 1 + Math.min(0.35, (level - 1) * 0.02);
  const wallH = 2.4 + visualTier * 0.12;
  const fire = Math.min(1, pressure);

  const merlons = useMemo(() => Array.from({ length: 7 }, (_, i) => i), []);

  return (
    <group position={[0, 0, 0]} scale={scale}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <planeGeometry args={[13.2, 13.2]} />
        <meshLambertMaterial color="#d2b48a" />
      </mesh>

      <Stone args={[14, wallH, 1.5]} position={[0, wallH / 2, -6.3]} />
      <Stone args={[5.2, wallH, 1.5]} position={[-4.4, wallH / 2, 6.3]} />
      <Stone args={[5.2, wallH, 1.5]} position={[4.4, wallH / 2, 6.3]} />
      <Stone args={[1.5, wallH, 14]} position={[-6.3, wallH / 2, 0]} />
      <Stone args={[1.5, wallH, 14]} position={[6.3, wallH / 2, 0]} />

      <mesh position={[0, 1.1, 6.55]}>
        <boxGeometry args={[3.2, 2.2, 0.45]} />
        <meshLambertMaterial color="#3a2418" />
      </mesh>
      <mesh position={[0, 1.35, 6.72]}>
        <boxGeometry args={[1.05, 1.7, 0.12]} />
        <meshLambertMaterial color="#8b1d1d" emissive="#4a0808" emissiveIntensity={0.35 + fire} />
      </mesh>

      {merlons.map((i) => (
        <Stone
          key={`n-${i}`}
          args={[0.7, 0.7, 1.1]}
          position={[-5.2 + i * 1.75, wallH + 0.32, -6.3]}
          color="#c4b094"
        />
      ))}

      <Tower position={[-6.4, 0, -6.4]} height={4.4} />
      <Tower position={[6.4, 0, -6.4]} height={4.4} />
      <Tower position={[-6.4, 0, 6.4]} height={4.1} />
      <Tower position={[6.4, 0, 6.4]} height={4.1} />
      <Tower position={[0, 0, -1.2]} height={5.6} keep />

      <mesh position={[-2.4, wallH + 0.9, 6.1]}>
        <boxGeometry args={[0.12, 1.8, 0.12]} />
        <meshLambertMaterial color="#d7c389" />
      </mesh>
      <mesh position={[-2.05, wallH + 0.55, 6.1]}>
        <planeGeometry args={[0.9, 1.2]} />
        <meshLambertMaterial color="#b01c1c" />
      </mesh>
      <mesh position={[2.4, wallH + 0.9, 6.1]}>
        <boxGeometry args={[0.12, 1.8, 0.12]} />
        <meshLambertMaterial color="#d7c389" />
      </mesh>
      <mesh position={[2.75, wallH + 0.55, 6.1]}>
        <planeGeometry args={[0.9, 1.2]} />
        <meshLambertMaterial color="#b01c1c" />
      </mesh>
    </group>
  );
}

function Tower({
  position,
  height,
  keep = false,
}: {
  position: [number, number, number];
  height: number;
  keep?: boolean;
}) {
  const r = keep ? 2.15 : 1.35;
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[r, r + 0.15, height, 6]} />
        <meshLambertMaterial color={keep ? "#cbb79a" : "#b39f86"} />
      </mesh>
      <mesh position={[0, height + 0.85, 0]}>
        <coneGeometry args={[r + 0.15, 1.8, 6]} />
        <meshLambertMaterial color="#9b1c1c" />
      </mesh>
    </group>
  );
}
