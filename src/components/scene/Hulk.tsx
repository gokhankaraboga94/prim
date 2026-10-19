import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { REEL_HOLD } from "../../recordCanvas";
import { devKick } from "../../devReel";

const HULK_URL = "/models/hulk+3d+model.glb";
const HEIGHT = 15.6;
const HIP = new THREE.Vector3(-0.155, 0.43, 0.02);
const KNEE = new THREE.Vector3(-0.145, 0.25, 0.005);
const ANKLE = new THREE.Vector3(-0.17, 0.09, -0.04);
const AXIS = new THREE.Vector3(1, 0, 0);
const qHip = new THREE.Quaternion();
const qKnee = new THREE.Quaternion();
const qAnkle = new THREE.Quaternion();
const tmp = new THREE.Vector3();
const relKnee = new THREE.Vector3();
const kneeNow = new THREE.Vector3();
const ankleNow = new THREE.Vector3();

function fade(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function HulkModel({ soldiers }: { soldiers: number }) {
  const rig = useRef<THREE.Group>(null);
  const swing = useMemo(
    () => ({
      geo: null as THREE.BufferGeometry | null,
      pos: null as THREE.BufferAttribute | null,
      rest: null as Float32Array | null,
      hip: null as Float32Array | null,
      knee: null as Float32Array | null,
      ankle: null as Float32Array | null,
      posed: false,
    }),
    []
  );
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    loader.load(HULK_URL, (gltf) => {
      const host = rig.current;
      if (drop || !host) return;
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.frustumCulled = false;
        const attr = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
        const rest = new Float32Array(attr.array.length);
        rest.set(attr.array as Float32Array);
        const hipW = new Float32Array(attr.count);
        const kneeW = new Float32Array(attr.count);
        const ankleW = new Float32Array(attr.count);
        for (let i = 0; i < attr.count; i++) {
          const x = rest[i * 3];
          const y = rest[i * 3 + 1];
          if (x > -0.04 || y > 0.5 || (y > 0.33 && x < -0.235)) continue;
          const hip = fade(0.48, 0.37, y) * fade(-0.04, -0.1, x);
          if (hip <= 0) continue;
          hipW[i] = hip;
          kneeW[i] = hip > 0.85 ? fade(0.3, 0.2, y) : 0;
          ankleW[i] = kneeW[i] > 0.9 ? fade(0.13, 0.05, y) : 0;
        }
        swing.geo = mesh.geometry;
        swing.pos = attr;
        swing.rest = rest;
        swing.hip = hipW;
        swing.knee = kneeW;
        swing.ankle = ankleW;
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
      swing.hip = null;
      swing.knee = null;
      swing.ankle = null;
      swing.posed = false;
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
    const pos = swing.pos;
    const rest = swing.rest;
    const hipW = swing.hip;
    const kneeW = swing.knee;
    const ankleW = swing.ankle;
    if (!pos || !rest || !hipW || !kneeW || !ankleW) return;
    const kick = devKick(Math.max(0, clock.elapsedTime - REEL_HOLD), soldiers);
    const active = Math.abs(kick.hip) + Math.abs(kick.knee) + Math.abs(kick.ankle) > 0.001;
    if (!active) {
      if (!swing.posed) return;
      (pos.array as Float32Array).set(rest);
      pos.needsUpdate = true;
      swing.geo?.computeVertexNormals();
      swing.posed = false;
      return;
    }
    qHip.setFromAxisAngle(AXIS, kick.hip);
    qKnee.setFromAxisAngle(AXIS, kick.knee);
    qAnkle.setFromAxisAngle(AXIS, kick.ankle);
    relKnee.copy(KNEE).sub(HIP).applyQuaternion(qHip);
    kneeNow.copy(relKnee).add(HIP);
    ankleNow.copy(ANKLE).sub(HIP).applyQuaternion(qHip).sub(relKnee).applyQuaternion(qKnee).add(relKnee).add(HIP);
    for (let i = 0; i < hipW.length; i++) {
      const wh = hipW[i];
      const o = i * 3;
      const ox = rest[o];
      const oy = rest[o + 1];
      const oz = rest[o + 2];
      if (wh <= 0) {
        pos.setXYZ(i, ox, oy, oz);
        continue;
      }
      tmp.set(ox - HIP.x, oy - HIP.y, oz - HIP.z).applyQuaternion(qHip);
      let x = ox + (HIP.x + tmp.x - ox) * wh;
      let y = oy + (HIP.y + tmp.y - oy) * wh;
      let z = oz + (HIP.z + tmp.z - oz) * wh;
      const wk = kneeW[i];
      if (wk > 0) {
        tmp.set(x - kneeNow.x, y - kneeNow.y, z - kneeNow.z).applyQuaternion(qKnee);
        x += (kneeNow.x + tmp.x - x) * wk;
        y += (kneeNow.y + tmp.y - y) * wk;
        z += (kneeNow.z + tmp.z - z) * wk;
      }
      const wa = ankleW[i];
      if (wa > 0) {
        tmp.set(x - ankleNow.x, y - ankleNow.y, z - ankleNow.z).applyQuaternion(qAnkle);
        x += (ankleNow.x + tmp.x - x) * wa;
        y += (ankleNow.y + tmp.y - y) * wa;
        z += (ankleNow.z + tmp.z - z) * wa;
      }
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    swing.geo?.computeVertexNormals();
    swing.posed = true;
  });
  return <group ref={rig} />;
}
