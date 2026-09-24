import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { REEL_HOLD } from "../../recordCanvas";
import { new1EnemyAt, new1EnemyCount, new2EnemyAt, type New1Pose } from "../../new1Reel";
import { getDefendRaiderGeometry } from "./SallyRaid";

const dummy = new THREE.Object3D();
const scratch: New1Pose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };

type New1FoesProps = {
  soldiers: number;
  duel?: boolean;
};

export function New1Foes({ soldiers, duel = false }: New1FoesProps) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const skip = useRef(0);
  const geo = useMemo(() => getDefendRaiderGeometry(true), []);
  const cap = Math.max(1, new1EnemyCount(soldiers));

  useFrame((state) => {
    if (!bodies.current) return;
    const recT = state.clock.elapsedTime - REEL_HOLD;
    skip.current += 1;
    if (!duel && cap > 3600 && recT > 2.1 && skip.current % 2 === 1) return;
    const n = cap;
    const place = duel ? new2EnemyAt : new1EnemyAt;
    for (let i = 0; i < n; i++) {
      place(i, soldiers, recT, scratch);
      dummy.position.set(scratch.x, scratch.y, scratch.z);
      dummy.rotation.set(scratch.rx, scratch.ry, scratch.rz);
      dummy.scale.setScalar(1.44);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(i, dummy.matrix);
    }
    bodies.current.count = n;
    bodies.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={bodies} args={[geo, undefined, cap]} frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={0.52} metalness={0.14} envMapIntensity={0.42} />
    </instancedMesh>
  );
}
