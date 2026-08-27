import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const MAX_SOLDIERS = 280;
const dummy = new THREE.Object3D();
const color = new THREE.Color();

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
      arr[i * 4] = (Math.random() - 0.5) * 22;
      arr[i * 4 + 1] = Math.random();
      arr[i * 4 + 2] = 8 + Math.random() * 26;
      arr[i * 4 + 3] = 0.7 + Math.random() * 0.7;
    }
    return arr;
  }, []);

  const shotSeeds = useMemo(() => {
    const arr = new Float32Array(48 * 3);
    for (let i = 0; i < 48; i++) {
      arr[i * 3] = Math.random();
      arr[i * 3 + 1] = Math.random() * Math.PI * 2;
      arr[i * 3 + 2] = 0.6 + Math.random() * 1.4;
    }
    return arr;
  }, []);

  useLayoutEffect(() => {
    if (!mesh.current) return;
    mesh.current.count = visible;
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [visible]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (mesh.current) {
      for (let i = 0; i < visible; i++) {
        const x = seeds[i * 4];
        const phase = seeds[i * 4 + 1];
        const z0 = seeds[i * 4 + 2];
        const spd = seeds[i * 4 + 3];
        const march = ((t * spd * 1.7 + z0) % 28) - 2;
        const bob = Math.abs(Math.sin(t * 9 + phase * 12)) * 0.18;
        dummy.position.set(x + Math.sin(t * 0.6 + phase) * 0.4, 0.55 + bob, 16 - march);
        dummy.rotation.set(0, Math.PI + Math.sin(t * 0.3 + phase) * 0.08, 0);
        dummy.scale.setScalar(0.85 + phase * 0.35);
        dummy.updateMatrix();
        mesh.current.setMatrixAt(i, dummy.matrix);
        color.setHSL(0.02, 0.55, 0.18 + phase * 0.22);
        mesh.current.setColorAt(i, color);
      }
      mesh.current.instanceMatrix.needsUpdate = true;
      if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    }

    if (shots.current) {
      const n = count > 0 ? 48 : 0;
      shots.current.count = n;
      for (let i = 0; i < n; i++) {
        const seed = shotSeeds[i * 3];
        const ang = shotSeeds[i * 3 + 1];
        const spd = shotSeeds[i * 3 + 2];
        const cycle = ((t * spd + seed * 10) % 2.4) / 2.4;
        const x = Math.cos(ang) * (6 + seed * 8);
        const z = 14 - cycle * 30;
        dummy.position.set(x, 1.2 + cycle * 6 + Math.sin(ang) * 0.4, z);
        dummy.scale.setScalar(0.35 + pressure * 0.3);
        dummy.rotation.set(cycle * 6, 0, 0);
        dummy.updateMatrix();
        shots.current.setMatrixAt(i, dummy.matrix);
      }
      shots.current.instanceMatrix.needsUpdate = true;
    }
  });

  if (count <= 0) return null;

  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, MAX_SOLDIERS]} frustumCulled={false}>
        <capsuleGeometry args={[0.22, 0.55, 4, 8]} />
        <meshStandardMaterial roughness={0.7} metalness={0.15} vertexColors />
      </instancedMesh>
      <instancedMesh ref={shots} args={[undefined, undefined, 48]} frustumCulled={false}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshBasicMaterial color="#ffb36a" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
