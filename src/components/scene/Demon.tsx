import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { REEL_HOLD } from "../../recordCanvas";
import { devMaceSwing } from "../../devReel";
import { simplifySkinned } from "../../knightSoldier";

const DEMON_URL = "/models/demon.glb";
const HEIGHT = 15.6 * 0.85;
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
      model.traverse((obj) => {
        const mesh = obj as THREE.SkinnedMesh;
        if (!mesh.isMesh) return;
        const geo = mesh.geometry;
        geo.computeBoundingBox();
        const span = geo.boundingBox ? Math.max(0.001, geo.boundingBox.max.y - geo.boundingBox.min.y) : 1;
        const next = simplifySkinned(geo, span * 0.016);
        mesh.geometry = next;
        geo.dispose();
        const src = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
        const cheap = new THREE.MeshLambertMaterial({ map: src.map ?? null, color: src.color ? src.color.clone() : "#ffffff" });
        src.map = null;
        src.normalMap?.dispose();
        src.roughnessMap?.dispose();
        src.metalnessMap?.dispose();
        src.dispose();
        mesh.material = cheap;
        mesh.frustumCulled = false;
      });
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
