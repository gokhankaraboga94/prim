import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import {
  ARAGORN_ISKELET,
  ARAGORN_RED,
  ARAGORN_URL,
  aragornCam,
  aragornClip,
  aragornMarkReady,
  aragornReset,
  aragornT,
} from "../../aragornTestReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

type Rig = {
  mix: THREE.AnimationMixer;
  shown: string;
  bag: Record<string, THREE.AnimationAction>;
};

type Line = { rigs: Rig[] };

const HEIGHT = 1.82;

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

/** Red bone name → Mixamo bone on islelet.glb. Root has no matching joint. */
const TO_MIXAMO: Record<string, string> = {
  pelvis: "mixamorig:Hips",
  spine_01: "mixamorig:Spine",
  spine_02: "mixamorig:Spine1",
  spine_03: "mixamorig:Spine2",
  neck_01: "mixamorig:Neck",
  head: "mixamorig:Head",
  head_leaf: "mixamorig:HeadTop_End",
  clavicle_l: "mixamorig:LeftShoulder",
  upperarm_l: "mixamorig:LeftArm",
  lowerarm_l: "mixamorig:LeftForeArm",
  hand_l: "mixamorig:LeftHand",
  index_01_l: "mixamorig:LeftHandIndex1",
  index_02_l: "mixamorig:LeftHandIndex2",
  index_03_l: "mixamorig:LeftHandIndex3",
  index_04_leaf_l: "mixamorig:LeftHandIndex4",
  middle_01_l: "mixamorig:LeftHandMiddle1",
  middle_02_l: "mixamorig:LeftHandMiddle2",
  middle_03_l: "mixamorig:LeftHandMiddle3",
  middle_04_leaf_l: "mixamorig:LeftHandMiddle4",
  pinky_01_l: "mixamorig:LeftHandPinky1",
  pinky_02_l: "mixamorig:LeftHandPinky2",
  pinky_03_l: "mixamorig:LeftHandPinky3",
  pinky_04_leaf_l: "mixamorig:LeftHandPinky4",
  ring_01_l: "mixamorig:LeftHandRing1",
  ring_02_l: "mixamorig:LeftHandRing2",
  ring_03_l: "mixamorig:LeftHandRing3",
  ring_04_leaf_l: "mixamorig:LeftHandRing4",
  thumb_01_l: "mixamorig:LeftHandThumb1",
  thumb_02_l: "mixamorig:LeftHandThumb2",
  thumb_03_l: "mixamorig:LeftHandThumb3",
  thumb_04_leaf_l: "mixamorig:LeftHandThumb4",
  clavicle_r: "mixamorig:RightShoulder",
  upperarm_r: "mixamorig:RightArm",
  lowerarm_r: "mixamorig:RightForeArm",
  hand_r: "mixamorig:RightHand",
  index_01_r: "mixamorig:RightHandIndex1",
  index_02_r: "mixamorig:RightHandIndex2",
  index_03_r: "mixamorig:RightHandIndex3",
  index_04_leaf_r: "mixamorig:RightHandIndex4",
  middle_01_r: "mixamorig:RightHandMiddle1",
  middle_02_r: "mixamorig:RightHandMiddle2",
  middle_03_r: "mixamorig:RightHandMiddle3",
  middle_04_leaf_r: "mixamorig:RightHandMiddle4",
  pinky_01_r: "mixamorig:RightHandPinky1",
  pinky_02_r: "mixamorig:RightHandPinky2",
  pinky_03_r: "mixamorig:RightHandPinky3",
  pinky_04_leaf_r: "mixamorig:RightHandPinky4",
  ring_01_r: "mixamorig:RightHandRing1",
  ring_02_r: "mixamorig:RightHandRing2",
  ring_03_r: "mixamorig:RightHandRing3",
  ring_04_leaf_r: "mixamorig:RightHandRing4",
  thumb_01_r: "mixamorig:RightHandThumb1",
  thumb_02_r: "mixamorig:RightHandThumb2",
  thumb_03_r: "mixamorig:RightHandThumb3",
  thumb_04_leaf_r: "mixamorig:RightHandThumb4",
  thigh_l: "mixamorig:LeftUpLeg",
  calf_l: "mixamorig:LeftLeg",
  foot_l: "mixamorig:LeftFoot",
  ball_l: "mixamorig:LeftToeBase",
  ball_leaf_l: "mixamorig:LeftToe_End",
  thigh_r: "mixamorig:RightUpLeg",
  calf_r: "mixamorig:RightLeg",
  foot_r: "mixamorig:RightFoot",
  ball_r: "mixamorig:RightToeBase",
  ball_leaf_r: "mixamorig:RightToe_End",
};

function retargetClip(clip: THREE.AnimationClip, source: THREE.Object3D, target: THREE.Object3D) {
  const tracks: THREE.KeyframeTrack[] = [];
  const q = new THREE.Quaternion();
  const out = new THREE.Quaternion();
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf(".");
    const bone = track.name.slice(0, dot);
    const prop = track.name.slice(dot + 1);
    const dstName = TO_MIXAMO[bone];
    const srcBone = source.getObjectByName(bone);
    const dstBone = dstName ? target.getObjectByName(dstName) : undefined;
    if (!dstName || !srcBone || !dstBone) continue;
    if (prop === "quaternion") {
      const inv = srcBone.quaternion.clone().invert();
      const rest = dstBone.quaternion;
      const values = track.values.slice();
      for (let i = 0; i < values.length; i += 4) {
        q.fromArray(values, i);
        out.copy(rest).multiply(inv).multiply(q);
        out.toArray(values, i);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${dstName}.quaternion`, track.times, values));
    } else if (prop === "position") {
      const from = srcBone.position;
      const rest = dstBone.position;
      const values = track.values.slice();
      for (let i = 0; i < values.length; i += 3) {
        values[i] = rest.x + (values[i] - from.x);
        values[i + 1] = rest.y + (values[i + 1] - from.y);
        values[i + 2] = rest.z + (values[i + 2] - from.z);
      }
      tracks.push(new THREE.VectorKeyframeTrack(`${dstName}.position`, track.times, values));
    }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function boundTracks(root: THREE.Object3D, clip: THREE.AnimationClip) {
  let hit = 0;
  for (const track of clip.tracks) {
    const name = track.name.split(".")[0];
    if (THREE.PropertyBinding.findNode(root, name)) hit += 1;
  }
  return hit;
}

function mountRig(root: THREE.Object3D, clips: THREE.AnimationClip[], label: string): Rig {
  const mix = new THREE.AnimationMixer(root);
  const bag: Record<string, THREE.AnimationAction> = {};
  let bound = 0;
  for (const clip of clips) {
    bound = Math.max(bound, boundTracks(root, clip));
    const action = mix.clipAction(clip);
    action.loop = THREE.LoopOnce;
    action.clampWhenFinished = true;
    bag[clip.name] = action;
  }
  const first = bag.Sword_Attack ?? Object.values(bag)[0];
  first?.reset().play();
  console.warn(bound > 0 ? `${label} kemik eslesti: ${bound}` : `${label} iskeleti yok, kirmizi klibi baglanamadi`);
  return { mix, shown: first?.getClip().name ?? "", bag };
}

export function AragornTest() {
  const host = useRef<THREE.Group>(null);
  const pack = useRef<Line | null>(null);

  useEffect(() => {
    let drop = false;
    aragornReset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const [hero, skel, red] = await Promise.all([
          loadGlb(loader, ARAGORN_URL),
          loadGlb(loader, ARAGORN_ISKELET),
          loadGlb(loader, ARAGORN_RED),
        ]);
        if (drop) return;
        const mixamoClips = red.animations.map((clip) => retargetClip(clip, red.scene, skel.scene));
        const seats: Array<[Gltf, number, string, THREE.AnimationClip[]]> = [
          [hero, -1.75, "aragorn", red.animations],
          [skel, 0, "iskelet", mixamoClips],
          [red, 1.75, "kirmizi", red.animations],
        ];
        const rigs: Rig[] = [];
        for (const [file, x, label, clips] of seats) {
          const model = file.scene;
          toLambert(model);
          fit(model);
          const holder = new THREE.Group();
          holder.position.x = x;
          holder.rotation.y = Math.PI;
          holder.add(model);
          host.current?.add(holder);
          rigs.push(mountRig(model, clips, label));
        }
        pack.current = { rigs };
      } catch (err) {
        console.warn("aragorn test", err);
      } finally {
        if (!drop) aragornMarkReady();
      }
    })();
    return () => {
      drop = true;
      for (const rig of pack.current?.rigs ?? []) rig.mix.stopAllAction();
      pack.current = null;
      host.current?.clear();
      aragornReset();
    };
  }, []);

  useFrame(() => {
    const live = pack.current;
    if (!live) return;
    const play = aragornClip(aragornT());
    for (const rig of live.rigs) {
      const action = rig.bag[play.name];
      if (action && rig.shown !== play.name) {
        rig.bag[rig.shown]?.stop();
        action.reset().play();
        rig.shown = play.name;
      }
      if (action) rig.mix.setTime(Math.min(action.getClip().duration - 0.001, play.time));
    }
  });

  return (
    <group>
      <hemisphereLight args={["#d7e6f4", "#6a5848", 1.4]} />
      <directionalLight position={[4, 12, -6]} intensity={1.7} color="#fff4e0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
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
