import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const MAX_SOLDIERS = 80;
const MAX_ARROWS = 8;
const dummy = new THREE.Object3D();
const VOLLEY_FLIGHT = 1.35;
const VOLLEY_REST = 2.5;

type ArmyProps = {
  count: number;
};

function unitPos(i: number, visible: number, t: number, out: THREE.Vector3) {
  const cols = Math.min(10, Math.max(1, visible));
  const col = i % cols;
  const row = Math.floor(i / cols);
  const x = (col - (cols - 1) / 2) * 1.2;
  const targetZ = 11.4;
  const startZ = 14.8 + row * 1.2;
  const atWall = row < 3;
  const z = atWall ? targetZ + row * 0.7 : startZ - Math.min(1, ((t * 0.16) % 4) / 2.2) * 2.4;
  const strike = atWall ? Math.abs(Math.sin(t * 7 + i)) * 0.14 : 0;
  out.set(x, 0.38 + strike, z);
}

export function Army({ count }: ArmyProps) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const helms = useRef<THREE.InstancedMesh>(null);
  const arrows = useRef<THREE.InstancedMesh>(null);
  const acc = useRef(0);
  const pos = useMemo(() => new THREE.Vector3(), []);

  const visible = Math.min(MAX_SOLDIERS, Math.max(0, Math.floor(count)));

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

    if (bodies.current && helms.current) {
      bodies.current.count = visible;
      helms.current.count = visible;
      for (let i = 0; i < visible; i++) {
        unitPos(i, visible, t + seeds[i], pos);
        dummy.position.copy(pos);
        dummy.rotation.set(0, Math.PI, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        bodies.current.setMatrixAt(i, dummy.matrix);
        dummy.position.y += 0.42;
        dummy.scale.setScalar(0.72);
        dummy.updateMatrix();
        helms.current.setMatrixAt(i, dummy.matrix);
      }
      bodies.current.instanceMatrix.needsUpdate = true;
      helms.current.instanceMatrix.needsUpdate = true;
    }

    if (!arrows.current) return;
    if (visible <= 0) {
      arrows.current.count = 0;
      return;
    }

    const volleySize = Math.min(MAX_ARROWS, Math.max(1, Math.ceil(visible * 0.1)));
    const cycle = VOLLEY_FLIGHT + VOLLEY_REST;
    const inCycle = t % cycle;
    if (inCycle > VOLLEY_FLIGHT) {
      arrows.current.count = 0;
      return;
    }

    const volley = Math.floor(t / cycle);
    const start = (volley * volleySize) % visible;
    const fly = inCycle / VOLLEY_FLIGHT;
    arrows.current.count = volleySize;

    for (let i = 0; i < volleySize; i++) {
      const soldier = (start + i) % visible;
      unitPos(soldier, visible, t, pos);
      dummy.position.set(
        pos.x * (1 - fly),
        0.9 + Math.sin(fly * Math.PI) * 2.4,
        pos.z + (6.4 - pos.z) * fly
      );
      dummy.rotation.set(0.7 - fly, 0, 0);
      dummy.scale.set(0.12, 0.12, 0.7);
      dummy.updateMatrix();
      arrows.current.setMatrixAt(i, dummy.matrix);
    }
    arrows.current.instanceMatrix.needsUpdate = true;
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
      <instancedMesh ref={arrows} args={[undefined, undefined, MAX_ARROWS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#f2d9a0" />
      </instancedMesh>
    </group>
  );
}
