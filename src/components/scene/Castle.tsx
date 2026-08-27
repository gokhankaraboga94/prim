import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type CastleProps = {
  level: number;
  pressure: number;
};

function Stone({
  args,
  position,
  rotation,
  color = "#8a7d6d",
}: {
  args: [number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow={false} receiveShadow={false}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.82} metalness={0.06} />
    </mesh>
  );
}

export function Castle({ level, pressure }: CastleProps) {
  const group = useRef<THREE.Group>(null);
  const fire = useRef<THREE.Points>(null);
  const visualTier = ((level - 1) % 5) + 1;
  const scale = 1 + Math.min(2.2, (level - 1) * 0.045) + visualTier * 0.04;
  const ember = Math.min(1, pressure * 1.15);

  const fireGeom = useMemo(() => {
    const count = 60;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 1] = Math.random() * 6;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 5;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return geom;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      group.current.position.y = Math.sin(t * 0.7) * 0.04;
      const shake = ember > 0.72 ? Math.sin(t * 38) * (ember - 0.72) * 0.08 : 0;
      group.current.rotation.z = shake;
    }
    if (fire.current) {
      fire.current.rotation.y = t * 0.12;
      const mat = fire.current.material as THREE.PointsMaterial;
      mat.opacity = 0.18 + ember * 0.55;
      mat.size = 0.18 + ember * 0.35;
    }
  });

  const wallH = 4.2 + visualTier * 0.35;
  const towerH = 7.2 + visualTier * 0.55;

  return (
    <group ref={group} position={[0, 0, -7]} scale={scale}>
      <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[16, 18, 0.6, 8]} />
        <meshStandardMaterial color="#4a4036" roughness={1} />
      </mesh>

      <Stone args={[16, wallH, 2.2]} position={[0, wallH / 2, 0]} color="#9a8d7a" />
      <Stone args={[2.4, wallH, 12]} position={[-7.2, wallH / 2, 5]} />
      <Stone args={[2.4, wallH, 12]} position={[7.2, wallH / 2, 5]} />
      <Stone args={[16, wallH * 0.85, 2]} position={[0, (wallH * 0.85) / 2, 11]} color="#7d7163" />

      <Tower position={[-8.2, 0, -0.4]} height={towerH} />
      <Tower position={[8.2, 0, -0.4]} height={towerH} />
      <Tower position={[-8.2, 0, 11]} height={towerH * 0.86} />
      <Tower position={[8.2, 0, 11]} height={towerH * 0.86} />
      {visualTier >= 3 && <Tower position={[0, 0, -1.2]} height={towerH * 1.18} keep />}

      <mesh position={[0, 1.6, 11.2]}>
        <boxGeometry args={[3.2, 3.2, 0.6]} />
        <meshStandardMaterial color="#1a120e" roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.7, 11.55]}>
        <boxGeometry args={[1.1, 2.2, 0.15]} />
        <meshStandardMaterial color="#7a1b1b" emissive="#3a0808" emissiveIntensity={0.6 + ember} />
      </mesh>

      <Banner position={[-3.6, wallH + 1.1, 0.2]} />
      <Banner position={[3.6, wallH + 1.1, 0.2]} />

      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[-6 + i * 2, wallH + 0.45, 0.1]}>
          <boxGeometry args={[0.7, 0.9, 1.1]} />
          <meshStandardMaterial color="#7a7164" roughness={0.9} />
        </mesh>
      ))}

      <points ref={fire} geometry={fireGeom} position={[0, 2.2, 4]}>
        <pointsMaterial
          color="#ff7a3c"
          size={0.32}
          transparent
          opacity={0.35}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
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
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[keep ? 2.1 : 1.45, keep ? 2.4 : 1.7, height, 8]} />
        <meshStandardMaterial color={keep ? "#b3a48f" : "#8f8374"} roughness={0.82} />
      </mesh>
      <mesh position={[0, height + 0.55, 0]}>
        <cylinderGeometry args={[keep ? 2.5 : 1.85, keep ? 2.2 : 1.55, 1.1, 8]} />
        <meshStandardMaterial color="#3d2a1c" roughness={0.7} />
      </mesh>
      <mesh position={[0, height + 1.7, 0]}>
        <coneGeometry args={[keep ? 2.1 : 1.5, 2.2, 8]} />
        <meshStandardMaterial color="#6b1616" emissive="#2a0505" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

function Banner({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 1.8 + position[0]) * 0.18;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 2.4, 6]} />
        <meshStandardMaterial color="#c9b37a" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh ref={ref} position={[0.45, 0.55, 0]}>
        <planeGeometry args={[1.1, 1.5]} />
        <meshStandardMaterial color="#9a1c1c" side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
    </group>
  );
}
