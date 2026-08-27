import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const MAX_SOLDIERS = 80;
const COLS = 10;
const dummy = new THREE.Object3D();

type ArmyProps = {
  count: number;
  pressure: number;
};

export function Army({ count }: ArmyProps) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const helms = useRef<THREE.InstancedMesh>(null);
  const acc = useRef(0);

  const visible = Math.min(MAX_SOLDIERS, count <= 0 ? 32 : Math.max(24, count));

  const seeds = useMemo(() => {
    const arr = new Float32Array(MAX_SOLDIERS);
    for (let i = 0; i < MAX_SOLDIERS; i++) arr[i] = Math.random();
    return arr;
  }, []);

  useLayoutEffect(() => {
    const color = new THREE.Color();
    if (!bodies.current) return;
    for (let i = 0; i < MAX_SOLDIERS; i++) {
      color.set(i % 7 === 0 ? "#d4b36a" : i % 3 === 0 ? "#6a1d1d" : "#3d4a63");
      bodies.current.setColorAt(i, color);
    }
    if (bodies.current.instanceColor) bodies.current.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state, dt) => {
    acc.current += dt;
    if (acc.current < 1 / 28) return;
    acc.current = 0;
    const t = state.clock.elapsedTime;

    if (!bodies.current || !helms.current) return;
    bodies.current.count = visible;
    helms.current.count = visible;
    for (let i = 0; i < visible; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const phase = seeds[i];
      const x =
        (col - (COLS - 1) / 2) * 1.15 + Math.sin(t * 1.6 + phase * 8) * (row < 2 ? 0.08 : 0.04);
      const targetZ = 11.4;
      const startZ = 14.8 + row * 1.2;
      const march = Math.min(1, ((t * 0.16 + phase) % 4) / 2.2);
      const atWall = row < 3;
      const z = atWall ? targetZ + row * 0.7 : startZ - march * (startZ - targetZ - 1.6);
      const strike = atWall ? Math.abs(Math.sin(t * 7 + phase * 10)) * 0.16 : 0;
      dummy.position.set(x, 0.38 + strike, z);
      dummy.rotation.set(0, Math.PI + (atWall ? Math.sin(t * 6 + phase) * 0.15 : 0), 0);
      dummy.scale.set(1, 1 + strike * 0.4, 1);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(i, dummy.matrix);
      dummy.position.y += 0.42;
      dummy.scale.setScalar(0.72);
      dummy.updateMatrix();
      helms.current.setMatrixAt(i, dummy.matrix);
    }
    bodies.current.instanceMatrix.needsUpdate = true;
    helms.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, MAX_SOLDIERS]} frustumCulled={false}>
        <boxGeometry args={[0.42, 0.62, 0.42]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={helms} args={[undefined, undefined, MAX_SOLDIERS]} frustumCulled={false}>
        <boxGeometry args={[0.34, 0.22, 0.34]} />
        <meshLambertMaterial color="#c9b37a" />
      </instancedMesh>
    </group>
  );
}
