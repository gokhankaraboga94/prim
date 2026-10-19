import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const HULK_URL = "/models/hulk+3d+model.glb";
const HEIGHT = 15.6;

export function HulkModel() {
  const rig = useRef<THREE.Group>(null);
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    loader.load(HULK_URL, (gltf) => {
      const host = rig.current;
      if (drop || !host) return;
      const model = gltf.scene;
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.frustumCulled = false;
      });
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const span = Math.max(0.001, box.max.y - box.min.y);
      const fit = HEIGHT / span;
      model.scale.setScalar(fit);
      model.position.set(-((box.min.x + box.max.x) / 2) * fit, -box.min.y * fit, -((box.min.z + box.max.z) / 2) * fit);
      host.add(model);
    });
    return () => {
      drop = true;
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
  }, []);
  return <group ref={rig} />;
}
