import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import {
  MAFYA_ENTRIES,
  MAFYA_N,
  mafyaCam,
  mafyaFar,
  mafyaGunFor,
  mafyaMarkReady,
  mafyaReset,
  mafyaSpot,
  mafyaT,
  type MafyaGun,
  type MafyaKind,
} from "../../mafyaReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

const MAN_H = 1.78;
const CAR_LEN = 5.6;

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
    mesh.material = new THREE.MeshLambertMaterial({
      map: src?.map ?? null,
      color: src?.color ? src.color.clone() : new THREE.Color("#ffffff"),
    });
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
  });
}

function fitMan(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const span = Math.max(0.001, box.max.y - box.min.y);
  const scale = MAN_H / span;
  root.scale.setScalar(scale);
  root.position.set(
    -((box.min.x + box.max.x) / 2) * scale,
    -box.min.y * scale,
    -((box.min.z + box.max.z) / 2) * scale
  );
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
  g.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  g.position.set(0.03, 0.08, 0.05);
  g.scale.setScalar(1.15);
  return g;
}

function attachGun(root: THREE.Object3D, kind: MafyaGun) {
  const hand =
    findBone(root, ["mixamorig:RightHand", "RightHand", "mixamorig_RightHand"]) ??
    findBone(root, ["mixamorig:LeftHand", "LeftHand"]);
  if (!hand) return;
  const gun = kind === "m4" ? makeM4() : makePistol();
  hand.add(gun);
}

function pickFireClip(clips: THREE.AnimationClip[]) {
  const prefer = ["fire", "silah ile ateş ediyor", "silah ile ateş ediyor koşarken"];
  for (const name of prefer) {
    const hit = clips.find((c) => c.name === name || c.name.toLowerCase() === name);
    if (hit) return hit;
  }
  const soft = clips.find((c) => /fire|ateş|silah/i.test(c.name));
  return soft ?? clips.find((c) => /run|walk/i.test(c.name)) ?? clips[0];
}

function numberSprite(n: number, kind: MafyaKind) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    ctx.beginPath();
    ctx.arc(128, 128, 110, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(8,8,10,0.88)";
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = kind === "car" ? "#6ec8ff" : "#ffe14a";
    ctx.stroke();
    ctx.fillStyle = kind === "car" ? "#6ec8ff" : "#ffe14a";
    ctx.font = "900 120px Inter, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), 128, 138);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(kind === "car" ? 1.1 : 0.55, kind === "car" ? 1.1 : 0.55, 1);
  spr.position.set(0, kind === "car" ? 3.4 : 2.15, 0);
  spr.renderOrder = 50;
  return spr;
}

type Man = { mix: THREE.AnimationMixer | null; hold: THREE.Group };

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow={false}>
      <planeGeometry args={[64, 22]} />
      <meshLambertMaterial color="#2a3038" />
    </mesh>
  );
}

export function MafyaCam() {
  useFrame(({ camera }) => {
    const persp = camera as THREE.PerspectiveCamera;
    if (!persp.isPerspectiveCamera) return;
    const shot = mafyaCam(mafyaT());
    persp.fov = shot.fov;
    persp.near = 0.12;
    persp.far = mafyaFar();
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

export function MafyaBattle() {
  const host = useRef<THREE.Group>(null);
  const men = useRef<Man[]>([]);

  useEffect(() => {
    mafyaReset();
    let drop = false;
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const files = await Promise.all(MAFYA_ENTRIES.map((e) => loadGlb(loader, e.url)));
        if (drop || !host.current) return;
        const root = host.current;
        root.clear();
        men.current = [];

        for (let i = 0; i < files.length; i++) {
          const entry = MAFYA_ENTRIES[i];
          const file = files[i];
          toLambert(file.scene);
          if (entry.kind === "car") fitCar(file.scene);
          else fitMan(file.scene);

          if (entry.kind === "man") attachGun(file.scene, mafyaGunFor(i));

          const hold = new THREE.Group();
          const spot = mafyaSpot(i);
          hold.position.set(spot.x, 0, spot.z);
          hold.rotation.y = spot.yaw;
          hold.add(file.scene);
          hold.add(numberSprite(entry.num, entry.kind));
          root.add(hold);

          let mix: THREE.AnimationMixer | null = null;
          if (entry.kind === "man") {
            mix = new THREE.AnimationMixer(file.scene);
            const clip = pickFireClip(file.animations);
            if (clip) {
              const action = mix.clipAction(clip);
              action.setLoop(THREE.LoopRepeat, Infinity);
              action.play();
            }
          }
          men.current.push({ mix, hold });
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
    for (const man of men.current) man.mix?.update(dt);
  });

  const labels = useMemo(() => MAFYA_ENTRIES.map((e) => e.num), []);

  return (
    <group>
      <ambientLight intensity={0.55} color="#e8eef6" />
      <directionalLight position={[4, 8, 6]} intensity={1.35} color="#ffffff" />
      <directionalLight position={[-5, 3, 2]} intensity={0.55} color="#a8c4e8" />
      <Ground />
      <group ref={host} />
      <group visible={false}>{labels.map((n) => <group key={n} />)}</group>
    </group>
  );
}
