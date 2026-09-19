import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { VS2_LADDERS, vs2Ladder } from "../../vsReel";

function makeLadderGeo(len: number) {
  const wood = (geo: THREE.BufferGeometry, x: number, y: number, z: number) => {
    geo.translate(x, y, z);
    return geo;
  };
  const pieces: THREE.BufferGeometry[] = [
    wood(new THREE.BoxGeometry(0.14, len, 0.14), -0.42, len / 2, 0),
    wood(new THREE.BoxGeometry(0.14, len, 0.14), 0.42, len / 2, 0),
  ];
  const rungs = Math.max(14, Math.round(len / 0.36));
  for (let i = 0; i < rungs; i++) {
    const y = 0.16 + (i / Math.max(1, rungs - 1)) * (len - 0.28);
    pieces.push(wood(new THREE.BoxGeometry(0.98, 0.07, 0.12), 0, y, 0.05));
  }
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((g) => g.dispose());
  return merged ?? new THREE.BoxGeometry(0.7, len, 0.08);
}

type VsLaddersProps = {
  level: number;
};

export function VsLadders({ level }: VsLaddersProps) {
  const items = useMemo(() => {
    return Array.from({ length: VS2_LADDERS }, (_, k) => {
      const L = vs2Ladder(k, level);
      const dy = L.topY - L.baseY;
      const dz = L.topZ - L.baseZ;
      const len = Math.max(4, Math.hypot(dy, dz));
      return { geo: makeLadderGeo(len), L, pitch: Math.atan2(dz, dy) };
    });
  }, [level]);

  return (
    <group>
      {items.map((item, i) => (
        <mesh
          key={i}
          geometry={item.geo}
          position={[item.L.x, item.L.baseY, item.L.baseZ]}
          rotation={[item.pitch, 0, 0]}
          castShadow
        >
          <meshStandardMaterial color="#6b4a28" roughness={0.88} metalness={0.05} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      ))}
    </group>
  );
}
