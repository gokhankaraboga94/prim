import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { REEL_HOLD } from "../../recordCanvas";
import { defendEnemyAt, defendRingLayout } from "../../defendReel";
import { getDefendRaiderGeometry } from "./SallyRaid";

const dummy = new THREE.Object3D();
const scratch = { x: 0, y: 0, z: 0, yaw: 0 };

type DefendRingProps = {
  soldiers: number;
};

export function DefendRing({ soldiers }: DefendRingProps) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => getDefendRaiderGeometry(), []);
  const layout = useMemo(() => defendRingLayout(soldiers), [soldiers]);
  const cap = layout.cap;

  useFrame((state) => {
    if (!bodies.current) return;
    const recT = state.clock.elapsedTime - REEL_HOLD;
    const t = state.clock.elapsedTime;
    let shown = 0;
    for (let r = 0; r < layout.rings.length; r++) {
      const spec = layout.rings[r];
      for (let i = 0; i < spec.n; i++) {
        if (shown >= cap) break;
        defendEnemyAt(layout, recT, r, i, t, scratch);
        dummy.position.set(scratch.x, scratch.y, scratch.z);
        dummy.rotation.set(0, scratch.yaw, 0);
        dummy.scale.setScalar(0.94);
        dummy.updateMatrix();
        bodies.current.setMatrixAt(shown, dummy.matrix);
        shown += 1;
      }
    }
    bodies.current.count = shown;
    bodies.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh key={cap} ref={bodies} args={[geo, undefined, cap]} frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={0.58} metalness={0.16} />
    </instancedMesh>
  );
}
