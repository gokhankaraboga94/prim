import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { REEL_HOLD } from "../../recordCanvas";
import { devMaceSwing } from "../../devReel";

const DEMON_URL = "/models/demon.glb";
const HEIGHT = 15.6;
const extra = new THREE.Quaternion();
const euler = new THREE.Euler();
const extraFore = new THREE.Quaternion();
const eulerFore = new THREE.Euler();

export function DemonModel({ soldiers }: { soldiers: number }) {
  const rig = useRef<THREE.Group>(null);
  const swing = useMemo(
    () => ({
      arm: null as THREE.Object3D | null,
      fore: null as THREE.Object3D | null,
      armRest: new THREE.Quaternion(),
      foreRest: new THREE.Quaternion(),
    }),
    []
  );
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    loader.load(DEMON_URL, (gltf) => {
      const host = rig.current;
      if (drop || !host) return;
      const model = gltf.scene;
      const arm = model.getObjectByName("R_Upperarm") ?? null;
      const fore = model.getObjectByName("R_Forearm") ?? null;
      if (arm) swing.armRest.copy(arm.quaternion);
      if (fore) swing.foreRest.copy(fore.quaternion);
      swing.arm = arm;
      swing.fore = fore;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const span = Math.max(0.001, box.max.y - box.min.y);
      const fit = HEIGHT / span;
      model.scale.setScalar(fit);
      model.position.set(-((box.min.x + box.max.x) / 2) * fit, -box.min.y * fit, -((box.min.z + box.max.z) / 2) * fit);
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) mesh.frustumCulled = false;
      });
      host.add(model);
    });
    return () => {
      drop = true;
      swing.arm = null;
      swing.fore = null;
      const host = rig.current;
      if (!host) return;
      host.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          const std = mat as THREE.MeshStandardMaterial;
          std.map?.dispose();
          std.normalMap?.dispose();
          std.roughnessMap?.dispose();
          std.metalnessMap?.dispose();
          mat.dispose();
        }
      });
      host.clear();
    };
  }, [swing]);
  useFrame(({ clock }) => {
    const arm = swing.arm;
    if (!arm) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const s = devMaceSwing(t, soldiers);
    const hit = Math.max(0, s.pitch);
    euler.set(hit * -0.28, s.twist * 0.15, s.pitch * 1.25);
    extra.setFromEuler(euler);
    arm.quaternion.copy(swing.armRest).multiply(extra);
    const fore = swing.fore;
    if (!fore) return;
    eulerFore.set(hit * -0.7, 0, 0);
    extraFore.setFromEuler(eulerFore);
    fore.quaternion.copy(swing.foreRest).multiply(extraFore);
  });
  return <group ref={rig} />;
}
