import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { REEL_HOLD } from "../../recordCanvas";
import { castleFrame } from "../../castleLayout";
import { DEFEND2_SORTIE, defendEnemyAt, defendRingLayout, isDefendSortie, type DefendId } from "../../defendReel";
import { getDefendRaiderGeometry } from "./SallyRaid";

const dummy = new THREE.Object3D();
const scratch = { x: 0, y: 0, z: 0, yaw: 0 };

type DefendRingProps = {
  soldiers: number;
  mode: DefendId;
  level?: number;
};

type BakedEnemy = {
  ring: number;
  i: number;
};

export function DefendRing({ soldiers, mode, level = 1 }: DefendRingProps) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const skip = useRef(0);
  const geo = useMemo(() => getDefendRaiderGeometry(), []);
  const layout = useMemo(() => defendRingLayout(soldiers, mode), [soldiers, mode]);
  const cap = layout.cap;
  const gateZ = useMemo(() => castleFrame(level).front, [level]);
  const baked = useMemo(() => {
    const list: BakedEnemy[] = [];
    for (let r = 0; r < layout.rings.length; r++) {
      const spec = layout.rings[r];
      for (let i = 0; i < spec.n; i++) list.push({ ring: r, i });
    }
    return list;
  }, [layout]);

  useFrame((state) => {
    if (!bodies.current) return;
    const recT = state.clock.elapsedTime - REEL_HOLD;
    const wrapping = isDefendSortie(mode) && recT < DEFEND2_SORTIE;
    skip.current += 1;
    if (!wrapping && skip.current % 2 === 1) return;
    const t = state.clock.elapsedTime;
    const n = Math.min(cap, baked.length);
    for (let k = 0; k < n; k++) {
      const item = baked[k];
      defendEnemyAt(layout, recT, item.ring, item.i, t, scratch, mode, gateZ);
      dummy.position.set(scratch.x, scratch.y, scratch.z);
      dummy.rotation.set(0, scratch.yaw, 0);
      dummy.scale.setScalar(scratch.y < -20 ? 0 : 1.48);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(k, dummy.matrix);
    }
    bodies.current.count = n;
    bodies.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh key={`${cap}-${mode}-spear-tip`} ref={bodies} args={[geo, undefined, cap]} frustumCulled={false}>
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  );
}
