import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { REEL_HOLD } from "../../recordCanvas";
import { vsEnemyAt, vsEnemyCount, type VsPose } from "../../vsReel";
import { getDefendRaiderGeometry } from "./SallyRaid";

const dummy = new THREE.Object3D();
const scratch: VsPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };

type VsFoesProps = {
  soldiers: number;
};

export function VsFoes({ soldiers }: VsFoesProps) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => getDefendRaiderGeometry(true), []);
  const cap = Math.max(1, vsEnemyCount(soldiers));

  useFrame((state) => {
    if (!bodies.current) return;
    const recT = state.clock.elapsedTime - REEL_HOLD;
    const n = cap;
    for (let i = 0; i < n; i++) {
      vsEnemyAt(i, soldiers, recT, scratch);
      dummy.position.set(scratch.x, scratch.y, scratch.z);
      dummy.rotation.set(scratch.rx, scratch.ry, scratch.rz);
      dummy.scale.setScalar(1.42);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(i, dummy.matrix);
    }
    bodies.current.count = n;
    bodies.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={bodies} args={[geo, undefined, cap]} frustumCulled={false}>
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  );
}
