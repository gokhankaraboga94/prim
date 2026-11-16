import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { dropGroundSlab } from "../../groundSlab";
import {
  MAFYA_ENTRIES,
  mafyaAlive,
  mafyaAimTarget,
  mafyaCam,
  mafyaDieAt,
  mafyaFar,
  mafyaGunFor,
  mafyaMarkReady,
  mafyaPos,
  mafyaReset,
  mafyaShots,
  mafyaSpot,
  mafyaT,
  mafyaYawTo,
  type MafyaGun,
  type MafyaKind,
  type MafyaShot,
} from "../../mafyaReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

const MAN_H = 1.78;
const CAR_LEN = 3.8;
const BULLET_N = 16;

function loadGlb(loader: GLTFLoader, url: string) {
  const buf = preloadedGlb(url);
  return new Promise<Gltf>((ok, fail) => {
    if (buf) loader.parse(buf.slice(0), "", ok, fail);
    else loader.load(url, ok, undefined, fail);
  });
}

function stripModelSlab(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    mesh.geometry = dropGroundSlab(mesh.geometry);
  });
}

function toLambert(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    mesh.material = new THREE.MeshLambertMaterial({
      map: src?.map ?? null,
      color: src?.color ? src.color.clone() : new THREE.Color("#ffffff"),
    });
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
  });
}

function fitMan(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const span = Math.max(0.001, box.max.y - box.min.y);
  const scale = MAN_H / span;
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.x += -((box2.min.x + box2.max.x) / 2);
  root.position.y += -box2.min.y;
  root.position.z += -((box2.min.z + box2.max.z) / 2);
}

const _footBox = new THREE.Box3();

/** Ayakları hold zemini olan y=0'a bas. */
function plantFeet(scene: THREE.Object3D, hold: THREE.Object3D) {
  hold.updateMatrixWorld(true);
  _footBox.setFromObject(scene);
  const dy = hold.position.y - _footBox.min.y;
  if (Math.abs(dy) > 1e-4) scene.position.y += dy;
}

function fitCar(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const sx = Math.max(0.001, box.max.x - box.min.x);
  const sz = Math.max(0.001, box.max.z - box.min.z);
  const len = Math.max(sx, sz);
  const scale = CAR_LEN / len;
  root.scale.setScalar(scale);
  root.position.set(
    -((box.min.x + box.max.x) / 2) * scale,
    -box.min.y * scale,
    -((box.min.z + box.max.z) / 2) * scale
  );
}

function findBone(root: THREE.Object3D, names: string[]): THREE.Object3D | null {
  const want = new Set(names);
  let found: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (found) return;
    if (want.has(obj.name)) {
      found = obj;
      return;
    }
    for (const n of names) {
      if (obj.name.endsWith(n)) {
        found = obj;
        return;
      }
    }
  });
  return found;
}

function metal(color: string, metalness = 0.92, roughness = 0.28) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    envMapIntensity: 1.2,
  });
}

function makePistol() {
  const g = new THREE.Group();
  g.name = "mafyaPistol";
  const steel = metal("#c5ccd4", 0.95, 0.22);
  const blue = metal("#8a949e", 0.9, 0.3);
  const grip = metal("#3a322c", 0.35, 0.65);
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.085, 0.18), steel);
  slide.position.set(0, 0.02, 0.06);
  g.add(slide);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), blue);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.028, 0.17);
  g.add(barrel);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.055), grip);
  handle.position.set(0, -0.04, 0.02);
  handle.rotation.x = 0.18;
  g.add(handle);
  const tip = new THREE.Object3D();
  tip.name = "muzzle";
  tip.position.set(0, 0.028, 0.22);
  g.add(tip);
  g.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  g.position.set(0.02, 0.06, 0.04);
  g.scale.setScalar(1.05);
  return g;
}

function makeM4() {
  const g = new THREE.Group();
  g.name = "mafyaM4";
  const steel = metal("#b8c0c8", 0.94, 0.24);
  const dark = metal("#6e767e", 0.88, 0.32);
  const stock = metal("#4a4038", 0.4, 0.55);
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.28), steel);
  receiver.position.set(0, 0.02, 0.08);
  g.add(receiver);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.32, 8), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, 0.3);
  g.add(barrel);
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.055, 0.16), dark);
  handguard.position.set(0, 0.015, 0.2);
  g.add(handguard);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.05), steel);
  mag.position.set(0, -0.06, 0.06);
  g.add(mag);
  const butt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.14), stock);
  butt.position.set(0, 0.01, -0.12);
  g.add(butt);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.045), stock);
  grip.position.set(0, -0.05, 0.0);
  grip.rotation.x = 0.25;
  g.add(grip);
  const tip = new THREE.Object3D();
  tip.name = "muzzle";
  tip.position.set(0, 0.03, 0.48);
  g.add(tip);
  g.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  g.position.set(0.03, 0.08, 0.05);
  g.scale.setScalar(1.15 * 0.8);
  return g;
}

function attachGun(root: THREE.Object3D, kind: MafyaGun) {
  const hand =
    findBone(root, ["mixamorig:RightHand", "RightHand", "mixamorig_RightHand"]) ??
    findBone(root, ["mixamorig:LeftHand", "LeftHand"]);
  if (!hand) return null;
  const gun = kind === "m4" ? makeM4() : makePistol();
  hand.add(gun);
  return gun;
}

/** Koşu / yürüyüş asla. m08'de fire yok → ateş-koşarken son çare. */
function pickFireClip(clips: THREE.AnimationClip[]) {
  const isRun = (n: string) => /(?:^|[^a-zıiğüşöç])(run|running|walk|walking)(?:$|[^a-zıiğüşöç])/i.test(n) || /koş|kosar|koşar/i.test(n);
  const isFire = (n: string) => /fire|ateş|ates|silah/i.test(n);

  const exact = ["fire", "silah ile ateş ediyor"];
  for (const name of exact) {
    const hit = clips.find((c) => c.name === name || c.name.toLowerCase() === name);
    if (hit) return hit;
  }

  const standingFire = clips.find((c) => isFire(c.name) && !isRun(c.name));
  if (standingFire) return standingFire;

  // m08: yalnızca "silah ile ateş ediyor koşarken" var — koşudan iyi
  const fireRun = clips.find((c) => isFire(c.name));
  if (fireRun) return fireRun;

  return null;
}

/** Sadece kök kaymayı kes — kalça rotasyonuna dokunma (duruş bozulmasın). */
function pinRootMotion(root: THREE.Object3D) {
  const hips = findBone(root, ["mixamorig:Hips", "Hips", "mixamorig_Hips"]);
  if (!hips) return;
  hips.position.x = 0;
  hips.position.z = 0;
}

type Man = {
  mix: THREE.AnimationMixer | null;
  hold: THREE.Group;
  scene: THREE.Object3D;
  muzzle: THREE.Object3D | null;
  team: 1 | 2;
  kind: MafyaKind;
};

const _muzzle = new THREE.Vector3();
const _target = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const dummy = new THREE.Object3D();
const _quat = new THREE.Quaternion();

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow={false}>
      <planeGeometry args={[48, 36]} />
      <meshLambertMaterial color="#4a5560" />
    </mesh>
  );
}

export function MafyaCam() {
  const primed = useRef(false);
  useFrame(({ camera }) => {
    const persp = camera as THREE.PerspectiveCamera;
    if (!persp.isPerspectiveCamera) return;
    const shot = mafyaCam(mafyaT());
    if (!primed.current) {
      persp.fov = shot.fov;
      persp.near = 0.15;
      persp.far = mafyaFar();
      persp.updateProjectionMatrix();
      primed.current = true;
    }
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

export function MafyaBattle() {
  const host = useRef<THREE.Group>(null);
  const men = useRef<Man[]>([]);
  const tracerRef = useRef<THREE.InstancedMesh>(null);
  const flashRef = useRef<THREE.InstancedMesh>(null);
  const hitRef = useRef<THREE.InstancedMesh>(null);
  const shotsRef = useRef<MafyaShot[]>([]);
  const frameRef = useRef(0);
  const shotCursor = useRef(0);

  useEffect(() => {
    mafyaReset();
    let drop = false;
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const uniqueUrls = [...new Set(MAFYA_ENTRIES.map((e) => e.url))];
        const loaded = await Promise.all(uniqueUrls.map((url) => loadGlb(loader, url)));
        if (drop || !host.current) return;
        const byUrl = new Map(uniqueUrls.map((url, i) => [url, loaded[i]]));
        for (const gltf of loaded) {
          stripModelSlab(gltf.scene);
          toLambert(gltf.scene);
        }

        const root = host.current;
        root.clear();
        men.current = [];
        shotsRef.current = mafyaShots().slice().sort((a, b) => a.t0 - b.t0);
        shotCursor.current = 0;
        frameRef.current = 0;

        for (let i = 0; i < MAFYA_ENTRIES.length; i++) {
          const entry = MAFYA_ENTRIES[i];
          const src = byUrl.get(entry.url);
          if (!src) continue;

          const scene = cloneSkinned(src.scene) as THREE.Group;
          const clips = src.animations;

          if (entry.kind === "car") fitCar(scene);
          else fitMan(scene);

          let muzzle: THREE.Object3D | null = null;
          if (entry.kind === "man") {
            const gun = attachGun(scene, mafyaGunFor(entry.num));
            muzzle = gun?.getObjectByName("muzzle") ?? gun;
          }

          const hold = new THREE.Group();
          const spot = mafyaSpot(i, 0);
          hold.position.set(spot.x, 0, spot.z);
          hold.rotation.order = "YXZ";
          hold.rotation.y = spot.yaw;
          hold.add(scene);
          root.add(hold);

          let mix: THREE.AnimationMixer | null = null;
          if (entry.kind === "man") {
            mix = new THREE.AnimationMixer(scene);
            const clip = pickFireClip(clips);
            if (clip) {
              const action = mix.clipAction(clip);
              action.setLoop(THREE.LoopRepeat, Infinity);
              action.timeScale = /koş|kos|run/i.test(clip.name) ? 0.45 : 1;
              action.play();
            }
            mix.update(0);
            pinRootMotion(scene);
            plantFeet(scene, hold);
          }
          men.current.push({ mix, hold, scene, muzzle, team: entry.team, kind: entry.kind });
        }
        if (!drop) mafyaMarkReady();
      } catch (err) {
        console.warn("mafya", err);
      }
    })();
    return () => {
      drop = true;
      for (const man of men.current) man.mix?.stopAllAction();
      men.current = [];
      host.current?.clear();
      mafyaReset();
    };
  }, []);

  useFrame((_, dt) => {
    const t = mafyaT();
    const frame = ++frameRef.current;
    const slice = frame % 6;
    const capped = Math.min(0.05, dt);

    // Animasyonları 6 kareye böl
    for (let i = slice; i < men.current.length; i += 6) {
      const man = men.current[i];
      if (!man.mix || !mafyaAlive(i, t) || !man.hold.visible) continue;
      man.mix.update(capped * 6);
      if (slice === 0) pinRootMotion(man.scene);
    }

    const tracers = tracerRef.current;
    const flashes = flashRef.current;
    const hits = hitRef.current;
    if (!tracers || !flashes || !hits) return;

    const shots = shotsRef.current;
    while (shotCursor.current < shots.length && t - shots[shotCursor.current].t0 > 0.45) {
      shotCursor.current += 1;
    }

    let slot = 0;
    let anyBullet = false;
    for (let s = shotCursor.current; s < shots.length && slot < BULLET_N; s++) {
      const shot = shots[s];
      const local = t - shot.t0;
      if (local < -0.02) break;
      if (local > shot.dur + 0.1) continue;
      if (!mafyaAlive(shot.fromI, shot.t0)) continue;
      const from = men.current[shot.fromI];
      const to = men.current[shot.toI];
      if (!from?.hold.visible || !to) continue;

      if (!anyBullet) {
        dummy.scale.setScalar(0.001);
        dummy.position.set(0, -40, 0);
        dummy.quaternion.identity();
        dummy.updateMatrix();
        for (let i = 0; i < BULLET_N; i++) {
          tracers.setMatrixAt(i, dummy.matrix);
          flashes.setMatrixAt(i, dummy.matrix);
          hits.setMatrixAt(i, dummy.matrix);
        }
        anyBullet = true;
      }

      const fp = mafyaPos(shot.fromI);
      _muzzle.set(fp.x, 1.35, fp.z);
      const tp = mafyaPos(shot.toI);
      _target.set(tp.x + shot.missX, 1.25 + shot.missY, tp.z + shot.missZ);

      if (local >= 0 && local < 0.05) {
        dummy.quaternion.identity();
        dummy.position.copy(_muzzle);
        dummy.scale.setScalar(0.05);
        dummy.updateMatrix();
        flashes.setMatrixAt(slot, dummy.matrix);
      }

      const u = Math.max(0, Math.min(1, local / shot.dur));
      _dir.subVectors(_target, _muzzle);
      const len = Math.max(0.01, _dir.length());
      _dir.multiplyScalar(1 / len);
      _mid.copy(_muzzle).addScaledVector(_dir, len * u);
      _quat.setFromUnitVectors(_up, _dir);
      dummy.position.copy(_mid);
      dummy.quaternion.copy(_quat);
      dummy.scale.set(0.01, Math.min(0.22, len * 0.025), 0.01);
      dummy.updateMatrix();
      tracers.setMatrixAt(slot, dummy.matrix);
      slot++;
    }

    // Aim 5 karede bir
    const refreshAim = frame % 5 === 0;
    for (let i = 0; i < men.current.length; i++) {
      const man = men.current[i];
      const dead = !mafyaAlive(i, t);
      const die = mafyaDieAt(i);
      const gone = dead && t >= die + 1;
      if (gone) {
        if (man.hold.visible) man.hold.visible = false;
        continue;
      }
      if (!man.hold.visible) man.hold.visible = true;

      const spot = mafyaPos(i);
      const fall = dead ? Math.min(1, (t - die) / 0.45) : 0;
      if (refreshAim || dead) {
        man.hold.rotation.y = mafyaYawTo(i, mafyaAimTarget(i, t), t);
      }
      man.hold.rotation.order = "YXZ";
      man.hold.rotation.x = fall * 1.35;
      man.hold.rotation.z = fall * 0.25 * ((i % 2) * 2 - 1);
      man.hold.position.set(spot.x, fall * 0.12, spot.z);
    }

    if (anyBullet) {
      tracers.instanceMatrix.needsUpdate = true;
      flashes.instanceMatrix.needsUpdate = true;
      hits.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <ambientLight intensity={0.7} color="#e8eef6" />
      <directionalLight position={[4, 8, 6]} intensity={1.2} color="#ffffff" />
      <Ground />
      <group ref={host} />
      <instancedMesh ref={tracerRef} args={[undefined, undefined, BULLET_N]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 3]} />
        <meshBasicMaterial color="#ffe566" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={flashRef} args={[undefined, undefined, BULLET_N]} frustumCulled={false}>
        <sphereGeometry args={[1, 4, 4]} />
        <meshBasicMaterial color="#fff2a8" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={hitRef} args={[undefined, undefined, BULLET_N]} frustumCulled={false}>
        <sphereGeometry args={[1, 3, 3]} />
        <meshBasicMaterial color="#ff7a3a" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
