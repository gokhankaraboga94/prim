import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { REEL_HOLD } from "../../recordCanvas";
import { castleFrame } from "../../castleLayout";
import { defendEnemyAt, defendRingLayout, type DefendId } from "../../defendReel";
import { getDefendRaiderGeometry } from "./SallyRaid";

const dummy = new THREE.Object3D();
const scratch = { x: 0, y: 0, z: 0, yaw: 0 };

type DefendRingProps = {
  soldiers: number;
  mode: DefendId;
  level?: number;
};

export function DefendRing({ soldiers, mode, level = 1 }: DefendRingProps) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => getDefendRaiderGeometry(), []);
  const layout = useMemo(() => defendRingLayout(soldiers, mode), [soldiers, mode]);
  const cap = layout.cap;
  const gateZ = useMemo(() => castleFrame(level).front, [level]);

  useFrame((state) => {
    if (!bodies.current) return;
    const recT = state.clock.elapsedTime - REEL_HOLD;
    const t = state.clock.elapsedTime;
    let shown = 0;
    for (let r = 0; r < layout.rings.length; r++) {
      const spec = layout.rings[r];
      for (let i = 0; i < spec.n; i++) {
        if (shown >= cap) break;
        defendEnemyAt(layout, recT, r, i, t, scratch, mode, gateZ);
        dummy.position.set(scratch.x, scratch.y, scratch.z);
        dummy.rotation.set(0.08, scratch.yaw, 0);
        dummy.scale.setScalar(1.55);
        dummy.updateMatrix();
        bodies.current.setMatrixAt(shown, dummy.matrix);
        shown += 1;
      }
    }
    bodies.current.count = shown;
    bodies.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh key={`${cap}-${mode}`} ref={bodies} args={[geo, undefined, cap]} frustumCulled={false}>
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  );
}
