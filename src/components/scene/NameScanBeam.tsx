import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { REEL_HOLD } from "../../recordCanvas";
import { HARIKA4_LOCK, harika4ScanX } from "../../xxxReel";
import { armyFrame } from "./Army";

/** Achromatic search band — gold island stays the only chromatic pop-out. */
export function NameScanBeam({ soldiers }: { soldiers: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const form = useMemo(() => armyFrame(soldiers, 0, true), [soldiers]);
  const halfW = Math.max(4.8, form.width * 0.5);

  useFrame(({ clock }) => {
    const recT = clock.elapsedTime - REEL_HOLD;
    const x = harika4ScanX(recT, halfW);
    const lock = recT >= HARIKA4_LOCK - 0.15 && recT < HARIKA4_LOCK + 0.5;
    const wide = recT >= 1.5 && recT < 4;
    if (mesh.current) {
      mesh.current.position.set(x, 3.15, form.front + 0.35);
      const w = lock ? 3.4 : wide ? 2.7 : 2.2;
      mesh.current.scale.set(w / 2.2, 1, 1);
    }
    if (mat.current) {
      mat.current.opacity = recT < 0 ? 0 : lock ? 0.34 : wide ? 0.26 : 0.2;
    }
  });

  return (
    <mesh ref={mesh} position={[0, 3.15, form.front + 0.35]} renderOrder={8}>
      <planeGeometry args={[2.2, 7.2]} />
      <meshBasicMaterial
        ref={mat}
        color="#f4efe4"
        transparent
        opacity={0.2}
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
