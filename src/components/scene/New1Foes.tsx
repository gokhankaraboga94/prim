import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { REEL_HOLD } from "../../recordCanvas";
import { NEW5_FOES, new1EnemyAt, new1EnemyCount, new2EnemyAt, new2VisualFriends, new5EnemyAt, type New1Pose } from "../../new1Reel";
import { getDefendRaiderGeometry, getSwordRaiderGeometry } from "./SallyRaid";

const dummy = new THREE.Object3D();
const scratch: New1Pose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1 };

type New1FoesProps = {
  soldiers: number;
  duel?: boolean;
  swords?: boolean;
  bridge?: boolean;
};

export function New1Foes({ soldiers, duel = false, swords = false, bridge = false }: New1FoesProps) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const skip = useRef(0);
  const geo = useMemo(() => (swords || bridge ? getSwordRaiderGeometry() : getDefendRaiderGeometry(true)), [swords, bridge]);
  const fightFriends = duel ? new2VisualFriends(soldiers) : soldiers;
  const cap = bridge ? NEW5_FOES : Math.max(1, new1EnemyCount(fightFriends));

  useFrame((state) => {
    if (!bodies.current) return;
    const recT = state.clock.elapsedTime - REEL_HOLD;
    skip.current += 1;
    if (!duel && cap > 3600 && recT > 2.1 && skip.current % 2 === 1) return;
    const n = cap;
    for (let i = 0; i < n; i++) {
      if (bridge) new5EnemyAt(i, recT, scratch);
      else if (duel) new2EnemyAt(i, fightFriends, recT, scratch);
      else new1EnemyAt(i, fightFriends, recT, scratch);
      dummy.position.set(scratch.x, scratch.y, scratch.z);
      dummy.rotation.set(scratch.rx, scratch.ry, scratch.rz);
      dummy.scale.setScalar((scratch.s ?? 1) > 0 ? 1.44 : 0);
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
