import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { DOVUS_FALL, DOVUS_HERO, DOVUS_RED, dovusCam, dovusMarkReady, dovusReset, dovusT } from "../../dovusReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

const HEIGHT = 1.82;
const AX = new THREE.Vector3(1, 0, 0);
const AZ = new THREE.Vector3(0, 0, 1);
const qx = new THREE.Quaternion();
const qz = new THREE.Quaternion();

type Arm = {
  mesh: THREE.SkinnedMesh;
  bones: Record<string, THREE.Bone>;
  rest: Record<string, THREE.Quaternion>;
};

type RedFight = {
  mix: THREE.AnimationMixer;
  sword: THREE.AnimationAction;
  death: THREE.AnimationAction;
  swordDur: number;
  deathDur: number;
  phase: number;
  dieAt: number;
  dead: boolean;
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

function swing(arm: Arm, name: string, x: number, z: number) {
  const bone = arm.bones[name];
  const rest = arm.rest[name];
  if (!bone || !rest) return;
  qz.setFromAxisAngle(AZ, z);
  qx.setFromAxisAngle(AX, x);
  bone.quaternion.copy(rest).multiply(qz).multiply(qx);
}

function strike(arm: Arm, t: number) {
  const reach = 0.22 + 0.5 * Math.max(0, Math.sin(t * 4.6 + 1.15));
  swing(arm, "mixamorig:RightArm", -0.35, reach);
  swing(arm, "mixamorig:RightForeArm", 0.2, 0);
  const hips = arm.bones["mixamorig:Hips"];
  hips?.updateWorldMatrix(true, true);
  arm.mesh.skeleton.update();
}

export function DovusBattle() {
  const host = useRef<THREE.Group>(null);
  const arm = useRef<Arm | null>(null);
  const reds = useRef<RedFight[]>([]);

  useEffect(() => {
    let drop = false;
    dovusReset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const [heroFile, redFile] = await Promise.all([loadGlb(loader, DOVUS_HERO), loadGlb(loader, DOVUS_RED)]);
        if (drop) return;
        const hero = heroFile.scene;
        toLambert(hero);
        const mesh = plantBones(hero);
        fit(hero);
        const heroHold = new THREE.Group();
        heroHold.position.set(0, 0, 0.22);
        heroHold.rotation.y = Math.PI / 2;
        heroHold.add(hero);
        host.current?.add(heroHold);
        if (mesh) {
          const names = ["mixamorig:Hips", "mixamorig:RightArm", "mixamorig:RightForeArm"];
          const bones: Arm["bones"] = {};
          const rest: Arm["rest"] = {};
          for (const name of names) {
            const bone = findBone(hero, name);
            if (!bone) continue;
            bones[name] = bone;
            rest[name] = bone.quaternion.clone();
          }
          arm.current = { mesh, bones, rest };
          strike(arm.current, 0);
        }

        toLambert(redFile.scene);
        const swordClip = redFile.animations.find((clip) => clip.name === "Sword_Attack");
        const deathClip = redFile.animations.find((clip) => clip.name === "Death_B");
        const seats = [
          { x: -0.58, phase: 0.62 },
          { x: 0.58, phase: 0.18 },
        ];
        const fights: RedFight[] = [];
        seats.forEach((seat, i) => {
          const model = cloneSkinned(redFile.scene) as THREE.Group;
          fit(model);
          const hold = new THREE.Group();
          hold.position.set(seat.x, 0, -0.58);
          hold.rotation.y = 0;
          hold.add(model);
          host.current?.add(hold);
          if (!swordClip || !deathClip) return;
          const mix = new THREE.AnimationMixer(model);
          const sword = mix.clipAction(swordClip);
          sword.loop = THREE.LoopRepeat;
          sword.play();
          const death = mix.clipAction(deathClip);
          death.loop = THREE.LoopOnce;
          death.clampWhenFinished = true;
          fights.push({
            mix,
            sword,
            death,
            swordDur: swordClip.duration,
            deathDur: deathClip.duration,
            phase: seat.phase,
            dieAt: DOVUS_FALL[i],
            dead: false,
          });
        });
        reds.current = fights;
      } catch (err) {
        console.warn("dovus", err);
      } finally {
        if (!drop) dovusMarkReady();
      }
    })();
    return () => {
      drop = true;
      for (const red of reds.current) red.mix.stopAllAction();
      reds.current = [];
      arm.current = null;
      host.current?.clear();
      dovusReset();
    };
  }, []);

  useFrame(() => {
    const t = dovusT();
    if (arm.current) strike(arm.current, t);
    for (const red of reds.current) {
      if (t < red.dieAt) {
        if (red.dead) {
          red.death.stop();
          red.sword.reset().play();
          red.dead = false;
        }
        const time = (t + red.phase) % red.swordDur;
        red.mix.setTime(time);
      } else {
        if (!red.dead) {
          red.sword.stop();
          red.death.reset().play();
          red.dead = true;
        }
        red.mix.setTime(Math.min(red.deathDur - 0.001, t - red.dieAt));
      }
    }
  });

  return (
    <group>
      <hemisphereLight args={["#d7e6f4", "#6a5848", 1.4]} />
      <directionalLight position={[4, 12, -6]} intensity={1.7} color="#fff4e0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[24, 24]} />
        <meshLambertMaterial color="#6a734c" />
      </mesh>
      <group ref={host} />
    </group>
  );
}

export function DovusCam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const shot = dovusCam(dovusT());
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
