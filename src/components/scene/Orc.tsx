import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { REEL_HOLD } from "../../recordCanvas";
import { devMaceSwing } from "../../devReel";
import { simplifySkinned } from "../../knightSoldier";

const ORC_URL = "/models/orc.glb";
const HEIGHT = 15.6 * 0.7;
const LEFT = new THREE.Vector3(-0.15, 0.6, 0.02);
const RIGHT = new THREE.Vector3(0.15, 0.6, 0.02);
const qLeft = new THREE.Quaternion();
const qRight = new THREE.Quaternion();
const euler = new THREE.Euler();
const tmp = new THREE.Vector3();

export function OrcModel({ soldiers }: { soldiers: number }) {
  const rig = useRef<THREE.Group>(null);
  const swing = useMemo(
    () => ({
      geo: null as THREE.BufferGeometry | null,
      pos: null as THREE.BufferAttribute | null,
      rest: null as Float32Array | null,
      weight: null as Float32Array | null,
      side: null as Float32Array | null,
    }),
    []
  );
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    loader.load(ORC_URL, (gltf) => {
      const host = rig.current;
      if (drop || !host) return;
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
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
        const attr = next.getAttribute("position") as THREE.BufferAttribute;
        const rest = new Float32Array((attr.array as Float32Array).length);
        rest.set(attr.array as Float32Array);
        const weight = new Float32Array(attr.count);
        const side = new Float32Array(attr.count);
        for (let i = 0; i < attr.count; i++) {
          const x = rest[i * 3];
          const y = rest[i * 3 + 1];
          const ax = Math.abs(x);
          if (ax < 0.16 || y < 0.14 || y > 0.7) continue;
          side[i] = x < 0 ? -1 : 1;
          const u = Math.min(1, (ax - 0.16) / 0.14);
          weight[i] = u * u * (3 - 2 * u);
        }
        swing.geo = next;
        swing.pos = attr;
        swing.rest = rest;
        swing.weight = weight;
        swing.side = side;
      });
      const box = new THREE.Box3().setFromObject(model);
      const span = Math.max(0.001, box.max.y - box.min.y);
      const fit = HEIGHT / span;
      model.scale.setScalar(fit);
      model.position.set(-((box.min.x + box.max.x) / 2) * fit, -box.min.y * fit, -((box.min.z + box.max.z) / 2) * fit);
      host.add(model);
    });
    return () => {
      drop = true;
      swing.geo = null;
      swing.pos = null;
      swing.rest = null;
      swing.weight = null;
      swing.side = null;
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
          mat.dispose();
        }
      });
      host.clear();
    };
  }, [swing]);
  useFrame(({ clock }) => {
    const pos = swing.pos;
    const rest = swing.rest;
    const weight = swing.weight;
    const side = swing.side;
    if (!pos || !rest || !weight || !side) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const pitch = devMaceSwing(t, soldiers).pitch;
    euler.set(0, pitch * 1.05, 0);
    qLeft.setFromEuler(euler);
    euler.set(0, -pitch * 1.05, 0);
    qRight.setFromEuler(euler);
    for (let i = 0; i < side.length; i++) {
      const w = weight[i];
      if (w <= 0) continue;
      const o = i * 3;
      const pivot = side[i] < 0 ? LEFT : RIGHT;
      tmp.set(rest[o], rest[o + 1], rest[o + 2]).sub(pivot);
      tmp.applyQuaternion(side[i] < 0 ? qLeft : qRight).add(pivot);
      pos.setXYZ(i, rest[o] + (tmp.x - rest[o]) * w, rest[o + 1] + (tmp.y - rest[o + 1]) * w, rest[o + 2] + (tmp.z - rest[o + 2]) * w);
    }
    pos.needsUpdate = true;
    if (Math.abs(pitch) > 0.04) swing.geo?.computeVertexNormals();
  });
  return <group ref={rig} />;
}
