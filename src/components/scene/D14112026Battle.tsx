import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { formatCount } from "../../game";
import { buildNameAtlas, type NameAtlas, type NameCell } from "../../nameAtlas";
import { preloadedGlb } from "../../arenaPreload";
import {
  D14112026_HERO,
  D14112026_ROMAN,
  d1411Cam,
  d1411Caption,
  d1411Far,
  d1411Form,
  d1411Knight,
  d1411MarkReady,
  d1411Reset,
  d1411Roman,
  d1411T,
  makeD1411Layout,
  type D1411Layout,
} from "../../d14112026Reel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

const HERO_H = 1.82;

const dummy = new THREE.Object3D();
const lookDir = new THREE.Vector3();

function romanColor(src: THREE.Material) {
  const c = (src as THREE.MeshStandardMaterial).color;
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  const sat = max < 0.02 ? 0 : (max - min) / max;
  const skin = sat > 0.4 && c.r > 0.75 && c.g > 0.4 && c.b > 0.15 && c.b < 0.5;
  const leather = c.r > c.g && c.g > c.b && c.r < 0.45 && sat > 0.45;
  const steel = sat < 0.22 && max > 0.55 && max < 0.9 && min > 0.45;
  if (skin || leather || steel) return c.clone();
  return new THREE.Color("#c41c16");
}

function paintRoman(geo: THREE.BufferGeometry, color: THREE.Color) {
  const src = geo.getIndex() ? geo.toNonIndexed() : geo;
  const pos = src.getAttribute("position");
  const next = new THREE.BufferGeometry();
  next.setAttribute("position", pos.clone());
  const norm = src.getAttribute("normal");
  if (norm) next.setAttribute("normal", norm.clone());
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  next.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  if (!norm) next.computeVertexNormals();
  if (src !== geo) src.dispose();
  return next;
}

function withoutFootBase(geo: THREE.BufferGeometry) {
  const srcPos = geo.getAttribute("position");
  const srcNorm = geo.getAttribute("normal");
  const index = geo.getIndex();
  if (!srcPos) return geo;
  geo.computeBoundingBox();
  const bounds = geo.boundingBox;
  if (!bounds) return geo;
  const height = bounds.max.y - bounds.min.y;
  const wide = bounds.max.x - bounds.min.x > 0.22 && bounds.max.z - bounds.min.z > 0.22;
  if (wide && height < 0.05 && bounds.max.y < -0.15) return null;
  const hasBase = bounds.min.y < -0.3 && bounds.max.y > 0;
  if (!hasBase) return geo;
  const kept: number[] = [];
  const pushTri = (a: number, b: number, c: number) => {
    const top = Math.max(srcPos.getY(a), srcPos.getY(b), srcPos.getY(c));
    if (top < 0) return;
    kept.push(a, b, c);
  };
  if (index) {
    for (let i = 0; i < index.count; i += 3) pushTri(index.getX(i), index.getX(i + 1), index.getX(i + 2));
  } else {
    for (let i = 0; i < srcPos.count; i += 3) pushTri(i, i + 1, i + 2);
  }
  if (!kept.length) return null;
  if (kept.length === (index ? index.count : srcPos.count)) return geo;
  const next = new THREE.BufferGeometry();
  const positions = new Float32Array(kept.length * 3);
  const normals = srcNorm ? new Float32Array(kept.length * 3) : null;
  for (let i = 0; i < kept.length; i++) {
    const v = kept[i];
    positions[i * 3] = srcPos.getX(v);
    positions[i * 3 + 1] = srcPos.getY(v);
    positions[i * 3 + 2] = srcPos.getZ(v);
    if (normals && srcNorm) {
      normals[i * 3] = srcNorm.getX(v);
      normals[i * 3 + 1] = srcNorm.getY(v);
      normals[i * 3 + 2] = srcNorm.getZ(v);
    }
  }
  next.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (normals) next.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.dispose();
  return next;
}

function buildRoman(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const pieces: THREE.BufferGeometry[] = [];
  const box = new THREE.Box3();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const cloned = mesh.geometry.clone();
    cloned.applyMatrix4(mesh.matrixWorld);
    const geo = withoutFootBase(cloned);
    if (!geo) {
      cloned.dispose();
      return;
    }
    geo.computeBoundingBox();
    if (geo.boundingBox) box.union(geo.boundingBox);
    const src = mesh.material;
    pieces.push(paintRoman(geo, romanColor(Array.isArray(src) ? src[0] : src)));
    geo.dispose();
  });
  if (!pieces.length || box.isEmpty()) return null;
  const merged = mergeGeometries(pieces, false);
  for (const piece of pieces) piece.dispose();
  if (!merged) return null;
  const height = Math.max(0.001, box.max.y - box.min.y);
  const s = 1.66 / height;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  merged.applyMatrix4(new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-cx, -box.min.y, -cz)));
  merged.computeVertexNormals();
  return merged;
}

function pose(x: number, z: number, yaw: number, pitch: number, roll: number, show: boolean) {
  dummy.rotation.order = "YXZ";
  dummy.position.set(x, 0.05, z);
  dummy.rotation.set(pitch, yaw, roll);
  dummy.scale.setScalar(show ? 1 : 0);
  dummy.updateMatrix();
}

function inFront(camera: THREE.Camera, x: number, z: number) {
  camera.getWorldDirection(lookDir);
  const dx = x - camera.position.x;
  const dy = 1.4 - camera.position.y;
  const dz = z - camera.position.z;
  return dx * lookDir.x + dy * lookDir.y + dz * lookDir.z > 1.6;
}

export function D14112026Cam({ soldiers }: { soldiers: number }) {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = d1411Cam(d1411T(), soldiers);
    persp.fov = shot.fov;
    persp.near = 0.35;
    persp.far = d1411Far(soldiers);
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function CaptionHud({ day, soldiers }: { day: number; soldiers: number }) {
  const size = useThree((s) => s.size);
  const plate = useRef<THREE.Mesh>(null);
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 2048;
    c.height = 560;
    return c;
  }, []);
  const tex = useMemo(() => {
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.generateMipmaps = false;
    map.minFilter = THREE.LinearFilter;
    map.magFilter = THREE.LinearFilter;
    return map;
  }, [canvas]);
  const lastKey = useRef("");
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame(() => {
    const t = d1411T();
    const cap = d1411Caption(t, day);
    const key = cap ? `${cap.title}|${cap.sub}|${cap.accent}` : "";
    if (key !== lastKey.current) {
      lastKey.current = key;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, 2048, 560);
        if (cap) {
          roundRect(ctx, 48, 36, 1952, 480, 40);
          ctx.fillStyle = "rgba(6, 8, 14, 0.78)";
          ctx.fill();
          ctx.lineWidth = 14;
          ctx.strokeStyle = cap.accent === "red" ? "#ff3b30" : cap.accent === "gold" ? "#ffe14a" : "#f2f4f8";
          ctx.stroke();
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineJoin = "round";
          const titleFill = cap.accent === "red" ? "#ff4d42" : cap.accent === "gold" ? "#ffe14a" : "#ffffff";
          ctx.font = "900 132px Inter, Segoe UI, sans-serif";
          ctx.lineWidth = 18;
          ctx.strokeStyle = "rgba(0,0,0,0.92)";
          ctx.strokeText(cap.title, 1024, 190);
          ctx.fillStyle = titleFill;
          ctx.fillText(cap.title, 1024, 190);
          ctx.font = "800 64px Inter, Segoe UI, sans-serif";
          ctx.lineWidth = 12;
          ctx.strokeText(cap.sub, 1024, 360);
          ctx.fillStyle = "#f0f2f6";
          ctx.fillText(cap.sub, 1024, 360);
        }
        tex.needsUpdate = true;
      }
    }
    const pulse = 1 + Math.sin(t * 3.1) * 0.03;
    plate.current?.scale.set(pulse, pulse, 1);
    if (plate.current) plate.current.visible = Boolean(cap);
  });
  const w = size.width * 0.94;
  const h = w * (560 / 2048);
  return (
    <Hud renderPriority={3}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh ref={plate} position={[0, size.height / 2 - h * 0.52 - 18, 4]} renderOrder={30}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
      </mesh>
      <ScorePlate soldiers={soldiers} />
    </Hud>
  );
}

function ScorePlate({ soldiers }: { soldiers: number }) {
  const size = useThree((s) => s.size);
  const form = d1411Form(soldiers);
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 220;
    const ctx = canvas.getContext("2d");
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.generateMipmaps = false;
    map.minFilter = THREE.LinearFilter;
    map.magFilter = THREE.LinearFilter;
    if (!ctx) return map;
    ctx.clearRect(0, 0, 1600, 220);
    roundRect(ctx, 20, 20, 1560, 180, 28);
    ctx.fillStyle = "rgba(8, 4, 2, 0.82)";
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#ffe14a";
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 78px Inter, sans-serif";
    const line = `${formatCount(form.friends)} isim   VS   ${formatCount(form.foes)} perde`;
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.strokeText(line, 800, 110);
    ctx.fillStyle = "#fff4c4";
    ctx.fillText(line, 800, 110);
    return map;
  }, [form.foes, form.friends]);
  useEffect(() => () => tex.dispose(), [tex]);
  const w = size.width * 0.88;
  const h = w * (220 / 1600);
  return (
    <mesh position={[0, -size.height / 2 + h * 0.55 + 16, 3]} renderOrder={28}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
    </mesh>
  );
}

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

function fitHero(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const span = Math.max(0.001, box.max.y - box.min.y);
  const scale = HERO_H / span;
  root.scale.setScalar(scale);
  root.position.set(
    -((box.min.x + box.max.x) / 2) * scale,
    -box.min.y * scale,
    -((box.min.z + box.max.z) / 2) * scale
  );
}

function guardClip(clips: THREE.AnimationClip[]) {
  return (
    clips.find((clip) => clip.name.startsWith("The warrior assumes")) ??
    clips.find((clip) => clip.name.startsWith("The warrior aggressively")) ??
    clips.find((clip) => clip.name.startsWith("The warrior performs")) ??
    clips[0]
  );
}

type HeroMan = { i: number; hold: THREE.Group; mix: THREE.AnimationMixer };

function Fighters({ layout }: { layout: D1411Layout }) {
  const host = useRef<THREE.Group>(null);
  const heroes = useRef<HeroMan[]>([]);
  const romanRef = useRef<THREE.InstancedMesh | null>(null);

  useEffect(() => {
    d1411Reset();
    let drop = false;
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const [heroFile, romanFile] = await Promise.all([
          loadGlb(loader, D14112026_HERO),
          loadGlb(loader, D14112026_ROMAN),
        ]);
        if (drop || !host.current) return;
        const root = host.current;
        root.clear();
        heroes.current = [];
        romanRef.current = null;

        toLambert(heroFile.scene);
        fitHero(heroFile.scene);
        const clip = guardClip(heroFile.animations);
        const men: HeroMan[] = [];
        for (let i = 0; i < layout.friends; i++) {
          const model = cloneSkinned(heroFile.scene) as THREE.Group;
          const hold = new THREE.Group();
          hold.add(model);
          root.add(hold);
          const mix = new THREE.AnimationMixer(model);
          if (clip) {
            const action = mix.clipAction(clip);
            action.play();
            mix.setTime((i % 7) * 0.19);
          }
          men.push({ i, hold, mix });
        }
        heroes.current = men;

        const geo = buildRoman(romanFile.scene);
        if (!geo || drop) return;
        const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
        const mesh = new THREE.InstancedMesh(geo, mat, layout.foes);
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        root.add(mesh);
        romanRef.current = mesh;

        if (!drop) d1411MarkReady();
      } catch (err) {
        console.warn("14112026", err);
      }
    })();
    return () => {
      drop = true;
      for (const man of heroes.current) man.mix.stopAllAction();
      heroes.current = [];
      romanRef.current = null;
      host.current?.clear();
      d1411Reset();
    };
  }, [layout.friends, layout.foes]);

  useFrame(({ camera }, dt) => {
    const t = d1411T();
    const step = Math.min(0.05, Math.max(0, dt));
    for (const man of heroes.current) {
      const p = d1411Knight(layout, man.i, t);
      layout.liveX[man.i] = p.x;
      layout.liveZ[man.i] = p.z;
      const show = p.show && inFront(camera, p.x, p.z);
      man.hold.visible = show;
      man.hold.position.set(p.x, 0, p.z);
      man.hold.rotation.set(p.pitch, p.yaw, p.roll);
      if (show) man.mix.update(step);
    }
    const foes = romanRef.current;
    if (!foes) return;
    for (let i = 0; i < layout.foes; i++) {
      const p = d1411Roman(layout, i, t);
      const show = p.show && inFront(camera, p.x, p.z);
      pose(p.x, p.z, p.yaw, p.pitch, p.roll, show);
      foes.setMatrixAt(i, dummy.matrix);
    }
    foes.instanceMatrix.needsUpdate = true;
  });

  return <group ref={host} />;
}

function Names({ names, layout }: { names: string[]; layout: D1411Layout }) {
  const labels = useMemo(() => {
    const out: { slot: number; text: string }[] = [];
    for (let i = 0; i < layout.friends; i++) {
      const text = String(names[i] ?? "")
        .trim()
        .replace(/^@+/, "");
      if (text) out.push({ slot: i, text });
    }
    return out;
  }, [names, layout.friends]);
  const atlas = useMemo<NameAtlas>(() => {
    const items = labels.map((n) => ({ text: n.text, commander: false, plain: true, fill: "#ffe14a" }));
    try {
      return buildNameAtlas(items, true, true);
    } catch {
      return buildNameAtlas(items, true);
    }
  }, [labels]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const { camera } = useThree();
  useEffect(() => () => atlas.dispose(), [atlas]);

  useFrame(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const fov = persp.isPerspectiveCamera ? persp.fov : 50;
    const tanH = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * (1080 / 1920);
    camera.getWorldDirection(lookDir);
    dummy.quaternion.copy(camera.quaternion);
    for (let k = 0; k < labels.length; k++) {
      const cell: NameCell | undefined = atlas.cells[k];
      const mesh = cell ? refs.current[cell.sheet] : null;
      if (!cell || !mesh) continue;
      const slot = labels[k].slot;
      const x = layout.liveX[slot];
      const z = layout.liveZ[slot];
      const dx = x - camera.position.x;
      const dz = z - camera.position.z;
      const ahead = dx * lookDir.x + (2.45 - camera.position.y) * lookDir.y + dz * lookDir.z;
      const dist = Math.hypot(dx, camera.position.y - 2.45, dz);
      const hide = ahead < 1.8;
      const want = Math.min(layout.pitch * 0.9, dist * tanH * 0.5) * 1.15;
      const size = want / 2.9;
      dummy.position.set(x, 2.42, z);
      dummy.scale.set(hide ? 0 : cell.sx * size, hide ? 0 : cell.sy * size, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(cell.local, dummy.matrix);
    }
    for (const mesh of refs.current) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {atlas.sheets.map((sheet, s) =>
        sheet.count > 0 ? (
          <instancedMesh
            key={s}
            ref={(node) => {
              refs.current[s] = node;
            }}
            args={[sheet.geometry, sheet.material, sheet.count]}
            frustumCulled={false}
            renderOrder={40}
          />
        ) : null
      )}
    </group>
  );
}

export function D14112026Battle({ names, soldiers, day = 1 }: { names: string[]; soldiers: number; day?: number }) {
  const layout = useMemo(() => makeD1411Layout(soldiers), [soldiers]);
  return (
    <group>
      <CaptionHud day={day} soldiers={soldiers} />
      <Fighters layout={layout} />
      <Names names={names} layout={layout} />
    </group>
  );
}
