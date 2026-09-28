import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { REEL_HOLD } from "../../recordCanvas";
import { FILM_FOES, filmFoeAt } from "../../filmReel";
import type { New1Pose } from "../../new1Reel";

const dummy = new THREE.Object3D();
const scratch: New1Pose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1 };

function foeGeometry() {
  const pieces = [
    [0.16, 0.46, 0.16, -0.1, 0.28, 0],
    [0.16, 0.46, 0.16, 0.1, 0.28, 0],
    [0.46, 0.52, 0.22, 0, 0.92, 0],
    [0.12, 0.4, 0.12, -0.3, 0.96, 0],
    [0.12, 0.4, 0.12, 0.3, 0.96, 0],
    [0.22, 0.2, 0.2, 0, 1.36, 0],
    [0.05, 0.06, 0.7, 0.34, 0.9, 0.28],
  ].map(([w, h, d, x, y, z]) => {
    const box = new THREE.BoxGeometry(w, h, d);
    box.translate(x, y, z);
    return box;
  });
  return mergeGeometries(pieces) ?? new THREE.BoxGeometry(0.4, 1.2, 0.28);
}

export function FilmFoes() {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => foeGeometry(), []);
  useFrame(({ clock }) => {
    if (!bodies.current) return;
    const recT = clock.elapsedTime - REEL_HOLD;
    let shown = 0;
    for (let i = 0; i < FILM_FOES; i++) {
      filmFoeAt(i, recT, scratch);
      if ((scratch.s ?? 1) <= 0) continue;
      dummy.position.set(scratch.x, scratch.y, scratch.z);
      dummy.rotation.set(scratch.rx, scratch.ry, scratch.rz);
      dummy.scale.setScalar(1.15);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(shown, dummy.matrix);
      shown += 1;
    }
    bodies.current.count = shown;
    bodies.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={bodies} args={[geo, undefined, FILM_FOES]} frustumCulled={false}>
      <meshLambertMaterial color="#8d1a1a" />
    </instancedMesh>
  );
}
