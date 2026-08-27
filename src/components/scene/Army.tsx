import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const MAX_SOLDIERS = 120;
const dummy = new THREE.Object3D();

type ArmyProps = {
  count: number;
  pressure: number;
};

export function Army({ count, pressure }: ArmyProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const shots = useRef<THREE.InstancedMesh>(null);
  const visible = Math.min(MAX_SOLDIERS, Math.max(0, count));

  const seeds = useMemo(() => {
    const arr = new Float32Array(MAX_SOLDIERS * 4);
    for (let i = 0; i < MAX_SOLDIERS; i++) {
      arr[i * 4] = (Math.random() - 0.5) * 14;
      arr[i * 4 + 1] = Math.random();
      arr[i * 4 + 2] = 4 + Math.random() * 10;
      arr[i * 4 + 3] = 0.75 + Math.random() * 0.5;
    }
    return arr;
  }, []);

  const shotSeeds = useMemo(() => {
    const arr = new Float32Array(24 * 3);
    for (let i = 0; i < 24; i++) {
      arr[i * 3] = Math.random();
      arr[i * 3 + 1] = Math.random() * Math.PI * 2;
      arr[i * 3 + 2] = 0.7 + Math.random() * 1.1;
    }
    return arr;
  }, []);

  useLayoutEffect(() => {
    if (!mesh.current) return;
    mesh.current.count = visible;
    const color = new THREE.Color();
    for (let i = 0; i < MAX_SOLDIERS; i++) {
      color.setHSL(0.05, 0.45, 0.22 + seeds[i * 4 + 1] * 0.2);
      mesh.current.setColorAt(i, color);
    }
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [visible, seeds]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (mesh.current) {
      mesh.current.count = visible;
      for (let i = 0; i < visible; i++) {
        const x = seeds[i * 4];
        const phase = seeds[i * 4 + 1];
        const z0 = seeds[i * 4 + 2];
        const spd = seeds[i * 4 + 3];
        const march = ((t * spd * 1.2 + z0) % 16) - 1;
        const bob = Math.abs(Math.sin(t * 8 + phase * 10)) * 0.14;
        dummy.position.set(x + Math.sin(t * 0.5 + phase) * 0.25, 0.5 + bob, 8 - march);
        dummy.rotation.set(0, Math.PI, 0);
        dummy.scale.setScalar(0.9 + phase * 0.25);
        dummy.updateMatrix();
        mesh.current.setMatrixAt(i, dummy.matrix);
      }
      mesh.current.instanceMatrix.needsUpdate = true;
    }

    if (shots.current) {
      const n = visible > 0 ? 24 : 0;
      shots.current.count = n;
      for (let i = 0; i < n; i++) {
        const seed = shotSeeds[i * 3];
        const ang = shotSeeds[i * 3 + 1];
        const spd = shotSeeds[i * 3 + 2];
        const cycle = ((t * spd + seed * 8) % 2.2) / 2.2;
        dummy.position.set(Math.cos(ang) * (3 + seed * 5), 1.1 + cycle * 4, 7 - cycle * 16);
        dummy.scale.setScalar(0.4 + pressure * 0.25);
        dummy.updateMatrix();
        shots.current.setMatrixAt(i, dummy.matrix);
      }
      shots.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, MAX_SOLDIERS]} frustumCulled={false}>
        <capsuleGeometry args={[0.2, 0.5, 3, 6]} />
        <meshStandardMaterial roughness={0.65} metalness={0.12} vertexColors />
      </instancedMesh>
      <instancedMesh ref={shots} args={[undefined, undefined, 24]} frustumCulled={false}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshBasicMaterial color="#ffc07a" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
