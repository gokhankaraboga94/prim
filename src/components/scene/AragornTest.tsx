import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { ARAGORN_ISKELET, aragornCam, aragornMarkReady, aragornReset, aragornT } from "../../aragornTestReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

const HEIGHT = 1.82;
const AX = new THREE.Vector3(1, 0, 0);
const AZ = new THREE.Vector3(0, 0, 1);
const qx = new THREE.Quaternion();
const qz = new THREE.Quaternion();

type Walk = {
  mesh: THREE.SkinnedMesh;
  bones: Record<string, THREE.Bone>;
  rest: Record<string, THREE.Quaternion>;
  hipsY: number;
};

function loadGlb(loader: GLTFLoader, url: string) {
  const buf = preloadedGlb(url);
  return new Promise<Gltf>((ok, fail) => {
    if (buf) loader.parse(buf.slice(0), "", ok, fail);
    else loader.load(url, ok, undefined, fail);
  });
}

function toLambert(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    const next = new THREE.MeshLambertMaterial({
      map: src.map ?? null,
      color: src.color ? src.color.clone() : "#ffffff",
    });
    src.map = null;
    src.normalMap?.dispose();
    src.roughnessMap?.dispose();
    src.metalnessMap?.dispose();
    src.dispose();
    mesh.material = next;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
  });
}

function fit(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const span = Math.max(0.001, box.max.y - box.min.y);
  const scale = HEIGHT / span;
  root.scale.setScalar(scale);
  root.position.set(
    -((box.min.x + box.max.x) / 2) * scale,
    -box.min.y * scale,
    -((box.min.z + box.max.z) / 2) * scale,
  );
}

/** Node transforms in this file are empty. Put each bone on its bind joint so a local swing bends the limb. */
function plantBones(root: THREE.Object3D) {
  const found: { mesh: THREE.SkinnedMesh | null } = { mesh: null };
  root.traverse((obj) => {
    const skin = obj as THREE.SkinnedMesh;
    if (skin.isSkinnedMesh) found.mesh = skin;
  });
  const mesh = found.mesh;
  if (!mesh) return null;
  root.updateMatrixWorld(true);
  const bones = mesh.skeleton.bones;
  const worlds = bones.map((_, i) => new THREE.Matrix4().copy(mesh.skeleton.boneInverses[i]).invert());
  const local = new THREE.Matrix4();
  const parentInv = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  bones.forEach((bone, i) => {
    const parent = bone.parent as THREE.Bone | null;
    const parentIndex = parent ? bones.indexOf(parent) : -1;
    if (parentIndex >= 0) parentInv.copy(worlds[parentIndex]).invert();
    else if (bone.parent) parentInv.copy(bone.parent.matrixWorld).invert();
    else parentInv.identity();
    local.copy(parentInv).multiply(worlds[i]);
    local.decompose(pos, quat, scl);
    bone.position.copy(pos);
    bone.quaternion.copy(quat);
    bone.scale.copy(scl);
  });
  mesh.skeleton.update();
  return mesh;
}

function findBone(root: THREE.Object3D, name: string) {
  const safe = THREE.PropertyBinding.sanitizeNodeName(name);
  return root.getObjectByName(safe) as THREE.Bone | undefined;
}

function swing(walk: Walk, name: string, x: number, z: number) {
  const bone = walk.bones[name];
  const rest = walk.rest[name];
  if (!bone || !rest) return;
  qz.setFromAxisAngle(AZ, z);
  qx.setFromAxisAngle(AX, x);
  bone.quaternion.copy(rest).multiply(qz).multiply(qx);
}

function stepPose(walk: Walk, t: number) {
  const step = Math.sin(t * 6.2);
  const wave = Math.sin(t * 9);
  swing(walk, "mixamorig:LeftUpLeg", 0, step * 0.7);
  swing(walk, "mixamorig:RightUpLeg", 0, -step * 0.7);
  swing(walk, "mixamorig:LeftLeg", 0, -0.08 - Math.max(0, -step) * 0.28);
  swing(walk, "mixamorig:RightLeg", 0, -0.08 - Math.max(0, step) * 0.28);
  swing(walk, "mixamorig:LeftArm", 0, -step * 0.45);
  swing(walk, "mixamorig:LeftForeArm", 0.3, 0);
  swing(walk, "mixamorig:RightArm", -1.27 + wave * 0.24, 0);
  swing(walk, "mixamorig:RightForeArm", wave * 0.22, 0);
  swing(walk, "mixamorig:RightHand", wave * 0.16, 0);
  const hips = walk.bones["mixamorig:Hips"];
  if (hips) hips.position.y = walk.hipsY + Math.abs(step) * 0.012;
  walk.mesh.skeleton.update();
}

export function AragornTest() {
  const host = useRef<THREE.Group>(null);
  const pack = useRef<Walk | null>(null);

  useEffect(() => {
    let drop = false;
    aragornReset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const file = await loadGlb(loader, ARAGORN_ISKELET);
        if (drop) return;
        const model = file.scene;
        toLambert(model);
        const mesh = plantBones(model);
        fit(model);
        const holder = new THREE.Group();
        holder.rotation.y = Math.PI / 2;
        holder.add(model);
        host.current?.add(holder);
        if (!mesh) return;
        const names = [
          "mixamorig:Hips",
          "mixamorig:LeftUpLeg",
          "mixamorig:RightUpLeg",
          "mixamorig:LeftLeg",
          "mixamorig:RightLeg",
          "mixamorig:LeftArm",
          "mixamorig:LeftForeArm",
          "mixamorig:RightArm",
          "mixamorig:RightForeArm",
          "mixamorig:RightHand",
        ];
        const bones: Walk["bones"] = {};
        const rest: Walk["rest"] = {};
        for (const name of names) {
          const bone = findBone(model, name);
          if (!bone) {
            console.warn("kemik yok", name);
            continue;
          }
          bones[name] = bone;
          rest[name] = bone.quaternion.clone();
        }
        pack.current = { mesh, bones, rest, hipsY: bones["mixamorig:Hips"]?.position.y ?? 0 };
        stepPose(pack.current, 0);
      } catch (err) {
        console.warn("aragorn test", err);
      } finally {
        if (!drop) aragornMarkReady();
      }
    })();
    return () => {
      drop = true;
      pack.current = null;
      host.current?.clear();
      aragornReset();
    };
  }, []);

  useFrame(() => {
    const walk = pack.current;
    if (!walk) return;
    stepPose(walk, aragornT());
  });

  return (
    <group>
      <hemisphereLight args={["#d7e6f4", "#6a5848", 1.4]} />
      <directionalLight position={[4, 12, -6]} intensity={1.7} color="#fff4e0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshLambertMaterial color="#6a734c" />
      </mesh>
      <group ref={host} />
    </group>
  );
}

export function AragornCam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const shot = aragornCam();
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
