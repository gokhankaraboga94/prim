import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { REEL_HOLD } from "../../recordCanvas";
import { FILM_FOES, filmFoeAt } from "../../filmReel";
import type { New1Pose } from "../../new1Reel";
import { getSwordRaiderGeometry } from "./SallyRaid";

const dummy = new THREE.Object3D();
const scratch: New1Pose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1 };

export function FilmFoes() {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => getSwordRaiderGeometry(), []);
  useFrame(({ clock }) => {
    if (!bodies.current) return;
    const recT = clock.elapsedTime - REEL_HOLD;
    let shown = 0;
    for (let i = 0; i < FILM_FOES; i++) {
      filmFoeAt(i, recT, scratch);
      if ((scratch.s ?? 1) <= 0) continue;
      dummy.position.set(scratch.x, scratch.y, scratch.z);
      dummy.rotation.set(scratch.rx, scratch.ry, scratch.rz);
      dummy.scale.setScalar(1.32);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(shown, dummy.matrix);
      shown += 1;
    }
    bodies.current.count = shown;
    bodies.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={bodies} args={[geo, undefined, FILM_FOES]} frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={0.52} metalness={0.14} />
    </instancedMesh>
  );
}
