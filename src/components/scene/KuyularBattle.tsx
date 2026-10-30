import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { simplifySkinned } from "../../knightSoldier";
import { buildNameAtlas } from "../../nameAtlas";
import {
  BLUE_N,
  KUYULAR_BLUE,
  blueSeat,
  kuyularCam,
  kuyularFall,
  kuyularFocus,
  kuyularHit,
  kuyularMarkReady,
  kuyularNamed,
  kuyularReset,
  kuyularRoster,
  kuyularT,
  kuyularWells,
  type Side,
} from "../../kuyularReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

const HEIGHT = 1.62;
const dummy = new THREE.Object3D();

type Live = {
  side: Side;
  i: number;
  host: THREE.Group;
  mix: THREE.AnimationMixer;
  dur: number;
  phase: number;
};

type Drop = {
  side: Side;
  i: number;
  mesh: THREE.Object3D;
  yaw: number;
  hidden: boolean;
  inst: THREE.InstancedMesh;
  slot: number;
};

type WellView = { mesh: THREE.Mesh; open: number; radius: number };

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
      map: src.map ?? null,
      color: src.color ? src.color.clone() : "#ffffff",
    });
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
  });
}

function skinnedOf(root: THREE.Object3D) {
  const found: { mesh: THREE.SkinnedMesh | null } = { mesh: null };
  root.traverse((obj) => {
    const skin = obj as THREE.SkinnedMesh;
    if (skin.isSkinnedMesh && !found.mesh) found.mesh = skin;
  });
  return found.mesh;
}

function bakePose(mesh: THREE.SkinnedMesh) {
  mesh.updateWorldMatrix(true, true);
  mesh.skeleton.update();
  const geo = mesh.geometry;
  const pos = geo.getAttribute("position");
  const srcN = geo.getAttribute("normal");
  const idx = geo.getAttribute("skinIndex");
  const wgt = geo.getAttribute("skinWeight");
  const bones = mesh.skeleton.boneMatrices;
  const bind = mesh.bindMatrix;
  const bindInv = mesh.bindMatrixInverse;
  const out = new Float32Array(pos.count * 3);
  const outN = new Float32Array(pos.count * 3);
  const sum = new THREE.Matrix4();
  const bone = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const e = sum.elements;
  for (let i = 0; i < pos.count; i++) {
    for (let j = 0; j < 16; j++) e[j] = 0;
    if (idx && wgt) {
      for (let k = 0; k < 4; k++) {
        const bi = idx.getComponent(i, k);
        const w = wgt.getComponent(i, k);
        if (!w) continue;
        bone.fromArray(bones, bi * 16);
        const be = bone.elements;
        for (let j = 0; j < 16; j++) e[j] += be[j] * w;
      }
    }
    v.fromBufferAttribute(pos, i).applyMatrix4(bind).applyMatrix4(sum).applyMatrix4(bindInv);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
    if (srcN) {
      n.fromBufferAttribute(srcN, i);
      n.transformDirection(bind).transformDirection(sum).transformDirection(bindInv);
      outN[i * 3] = n.x;
      outN[i * 3 + 1] = n.y;
      outN[i * 3 + 2] = n.z;
    }
  }
  const baked = new THREE.BufferGeometry();
  baked.setAttribute("position", new THREE.BufferAttribute(out, 3));
  if (srcN) baked.setAttribute("normal", new THREE.BufferAttribute(outN, 3));
  const uv = geo.getAttribute("uv");
  if (uv) baked.setAttribute("uv", uv);
  if (geo.index) baked.setIndex(geo.index);
  baked.computeBoundingBox();
  return baked;
}

function poseClip(root: THREE.Object3D, clips: THREE.AnimationClip[], name: string, time: number) {
  const clip = clips.find((item) => item.name === name) ?? clips[0];
  if (!clip) return 0;
  const mix = new THREE.AnimationMixer(root);
  const action = mix.clipAction(clip);
  action.play();
  mix.setTime(Math.min(clip.duration - 0.001, time));
  mix.stopAllAction();
  return clip.duration;
}

export function KuyularBattle({ names }: { names: string[] }) {
  const host = useRef<THREE.Group>(null);
  const live = useRef<Live[]>([]);
  const drops = useRef<Drop[]>([]);
  const wells = useRef<WellView[]>([]);
  const roster = useMemo(() => kuyularRoster(names), [names]);
  const labeled = useMemo(
    () => roster.map((name, i) => ({ name, i })).filter((row) => row.name && kuyularNamed(row.i)),
    [roster],
  );
  const atlas = useMemo(
    () =>
      buildNameAtlas(
        labeled.map((row) => ({ text: row.name, commander: false, plain: false, fill: "#111111", frame: true, plate: "rgba(255,255,255,0.58)" })),
        true,
        false,
      ),
    [labeled],
  );

  useEffect(() => {
    for (const sheet of atlas.sheets) sheet.material.depthTest = false;
    return () => atlas.dispose();
  }, [atlas]);

  useEffect(() => {
    let drop = false;
    kuyularReset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const blueFile = await loadGlb(loader, KUYULAR_BLUE);
        if (drop || !host.current) return;
        const bakedBlue = prepare(blueFile, "Attack_Ground_Pound", 0.08);
        const root = host.current;
        const blues = crowd(root, bakedBlue, "blue", BLUE_N, "Attack_Ground_Pound", blueSeat);
        drops.current = blues.drops;
        live.current = blues.live;
        const holeMat = new THREE.MeshBasicMaterial({ color: "#070605" });
        const views: WellView[] = kuyularWells().map((well) => {
          const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 28), holeMat);
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(well.x, 0.07, well.z);
          mesh.renderOrder = 2;
          mesh.frustumCulled = false;
          root.add(mesh);
          return { mesh, open: well.t, radius: well.radius };
        });
        wells.current = views;
      } catch (err) {
        console.warn("kuyular", err);
      } finally {
        if (!drop) kuyularMarkReady();
      }
    })();
    return () => {
      drop = true;
      for (const man of live.current) man.mix.stopAllAction();
      live.current = [];
      drops.current = [];
      wells.current = [];
      host.current?.clear();
      kuyularReset();
    };
  }, []);

  useFrame(({ camera }) => {
    const t = kuyularT();
    for (const man of live.current) {
      const e = kuyularFall(man.side, man.i, t);
      const seat = blueSeat(man.i);
      man.host.position.set(seat.x, -e * 3.1, seat.z);
      man.host.rotation.set(e * 1.2, seat.yaw, 0);
      if (e === 0) man.mix.setTime((t * 0.85 + man.phase) % Math.max(0.05, man.dur));
    }
    for (const body of drops.current) {
      const e = kuyularFall(body.side, body.i, t);
      const seat = blueSeat(body.i);
      if (e > 0 && !body.hidden) {
        dummy.position.set(seat.x, -8, seat.z);
        dummy.scale.setScalar(0.001);
        dummy.rotation.set(0, seat.yaw, 0);
        dummy.updateMatrix();
        body.inst.setMatrixAt(body.slot, dummy.matrix);
        body.inst.instanceMatrix.needsUpdate = true;
        body.hidden = true;
      }
      body.mesh.visible = e > 0;
      if (e > 0) {
        body.mesh.position.set(seat.x, (body.mesh.userData.foot as number) - e * 3.1, seat.z);
        body.mesh.rotation.set(e * 1.2, body.yaw, 0);
      }
    }
    for (const well of wells.current) {
      const grow = Math.max(0, Math.min(1, (t - (well.open - 0.28)) / 0.32));
      const s = well.radius * grow * grow * (3 - 2 * grow);
      well.mesh.visible = s > 0.04;
      well.mesh.scale.setScalar(Math.max(0.001, s));
    }
    for (const sheet of atlas.sheets) {
      const inst = sheet.geometry.userData.mesh as THREE.InstancedMesh | undefined;
      if (!inst) continue;
      const sheetAt = atlas.sheets.indexOf(sheet);
      for (let n = 0; n < labeled.length; n++) {
        const cell = atlas.cells[n];
        if (!cell || cell.sheet !== sheetAt) continue;
        const row = labeled[n];
        const seat = blueSeat(row.i);
        const e = kuyularFall("blue", row.i, t);
        const shown = e < 0.4;
        const y = shown ? -e * 3.1 + 2.15 : -12;
        const dx = seat.x - camera.position.x;
        const dz = seat.z - camera.position.z;
        const dist = Math.hypot(dx, camera.position.y, dz);
        const w = shown ? Math.min(0.42, 0.16 + dist * 0.005) : 0.001;
        const h = (cell.sy * w) / Math.max(cell.sx, 0.01);
        dummy.position.set(seat.x, y, seat.z);
        dummy.quaternion.copy(camera.quaternion);
        dummy.scale.set(w, shown ? h : 0.001, 1);
        dummy.updateMatrix();
        inst.setMatrixAt(cell.local, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <hemisphereLight args={["#d7e6f4", "#6a5848", 1.35]} />
      <directionalLight position={[6, 14, -8]} intensity={1.7} color="#fff4e0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshLambertMaterial color="#6a734c" />
      </mesh>
      <group ref={host} />
      {atlas.sheets.map((sheet, s) => (
        <instancedMesh
          key={s}
          args={[sheet.geometry, sheet.material, Math.max(1, sheet.count)]}
          frustumCulled={false}
          renderOrder={20}
          ref={(node) => {
            sheet.geometry.userData.mesh = node;
          }}
        />
      ))}
      <KuyularBanner roster={roster} />
    </group>
  );
}

function fitName(ctx: CanvasRenderingContext2D, name: string, max: number) {
  let size = 92;
  ctx.font = `900 ${size}px Arial, sans-serif`;
  while (size > 42 && ctx.measureText(name).width > max) {
    size -= 4;
    ctx.font = `900 ${size}px Arial, sans-serif`;
  }
  return size;
}

function paintBanner(canvas: HTMLCanvasElement, prev: string, next: string, u: number, fade: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const alpha = 1 - fade;
  if (alpha < 0.02) return;
  const draw = (name: string, y: number, a: number) => {
    if (!name || a < 0.02) return;
    const size = fitName(ctx, name, w - 80);
    ctx.globalAlpha = alpha * a;
    ctx.lineWidth = Math.max(8, size * 0.14);
    ctx.strokeStyle = "#140e08";
    ctx.fillStyle = "#fff8ee";
    ctx.strokeText(name, w / 2, y);
    ctx.fillText(name, w / 2, y);
  };
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const y = h * 0.42;
  if (prev && prev !== next && u < 1) draw(prev, y - u * 78, 1 - u);
  draw(next, y + (1 - u) * 78, Math.max(u, prev === next ? 1 : u));
  ctx.globalAlpha = 1;
}

function KuyularBanner({ roster }: { roster: string[] }) {
  const size = useThree((s) => s.size);
  const shown = useRef("");
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 360;
    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame(() => {
    const focus = kuyularFocus(kuyularT());
    const next = roster[focus.index] ?? "";
    const prev = roster[focus.prev] ?? "";
    const key = `${prev}|${next}|${focus.u.toFixed(2)}|${focus.fade.toFixed(2)}`;
    if (shown.current === key) return;
    shown.current = key;
    paintBanner(tex.image as HTMLCanvasElement, prev, next, focus.u, focus.fade);
    tex.needsUpdate = true;
  });
  const gap = size.height * 0.055;
  const h = size.height * 0.16;
  const w = size.width;
  return (
    <Hud renderPriority={1}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh position={[0, size.height / 2 - gap - h / 2, 4]} renderOrder={40}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
      </mesh>
    </Hud>
  );
}

type Baked = {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  scale: number;
  foot: number;
  src: THREE.Object3D;
  clips: THREE.AnimationClip[];
};

function prepare(file: Gltf, clip: string, time: number): Baked {
  const src = file.scene;
  toLambert(src);
  const mesh = skinnedOf(src);
  if (mesh) mesh.geometry = simplifySkinned(mesh.geometry, 0.02);
  poseClip(src, file.animations, clip, time);
  const skin = skinnedOf(src);
  const geo = skin ? bakePose(skin) : new THREE.BufferGeometry();
  const box = geo.boundingBox ?? new THREE.Box3();
  const span = Math.max(0.001, box.max.y - box.min.y);
  const scale = HEIGHT / span;
  const mat = skin
    ? ((Array.isArray(skin.material) ? skin.material[0] : skin.material) as THREE.Material)
    : new THREE.MeshLambertMaterial({ color: "#888888" });
  return { geo, mat, scale, foot: -box.min.y * scale, src, clips: file.animations };
}

function crowd(
  root: THREE.Group,
  baked: Baked,
  side: Side,
  count: number,
  clipName: string,
  seatAt: (i: number) => { x: number; z: number; yaw: number; live: boolean },
) {
  const still: number[] = [];
  const men: Live[] = [];
  const falling: Drop[] = [];
  for (let i = 0; i < count; i++) {
    if (seatAt(i).live) continue;
    still.push(i);
  }
  const inst = new THREE.InstancedMesh(baked.geo, baked.mat, Math.max(1, still.length));
  inst.frustumCulled = false;
  still.forEach((i, slot) => {
    const seat = seatAt(i);
    dummy.position.set(seat.x, baked.foot, seat.z);
    dummy.rotation.set(0, seat.yaw, 0);
    dummy.scale.setScalar(baked.scale);
    dummy.updateMatrix();
    inst.setMatrixAt(slot, dummy.matrix);
    if (!kuyularHit(side, i)) return;
    const mesh = new THREE.Mesh(baked.geo, baked.mat);
    mesh.scale.setScalar(baked.scale);
    mesh.position.y = baked.foot;
    mesh.userData.foot = baked.foot;
    mesh.visible = false;
    mesh.frustumCulled = false;
    root.add(mesh);
    falling.push({ side, i, mesh, yaw: seat.yaw, hidden: false, inst, slot });
  });
  inst.instanceMatrix.needsUpdate = true;
  root.add(inst);

  const clip = baked.clips.find((item) => item.name === clipName) ?? baked.clips[0];
  for (let i = 0; i < count; i++) {
    const seat = seatAt(i);
    if (!seat.live) continue;
    const body = cloneSkinned(baked.src) as THREE.Group;
    body.scale.setScalar(baked.scale);
    body.position.y = baked.foot;
    const holder = new THREE.Group();
    holder.position.set(seat.x, 0, seat.z);
    holder.rotation.y = seat.yaw;
    holder.add(body);
    root.add(holder);
    const mix = new THREE.AnimationMixer(body);
    if (clip) {
      const action = mix.clipAction(clip);
      action.play();
    }
    men.push({ side, i, host: holder, mix, dur: Math.max(0.2, clip?.duration ?? 1), phase: (i % 5) * 0.17 });
  }
  return { live: men, drops: falling };
}

export function KuyularCam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const shot = kuyularCam(kuyularT());
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
