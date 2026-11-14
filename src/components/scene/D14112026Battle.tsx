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
  D1411_ATTACK_PREFIXES,
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
  dummy.position.set(x, show ? 0.05 : -20, z);
  dummy.rotation.set(pitch, yaw, roll);
  dummy.scale.setScalar(show ? 1 : 0.001);
  dummy.updateMatrix();
}

function inFront(camera: THREE.Camera, x: number, z: number) {
  camera.getWorldDirection(lookDir);
  const dx = x - camera.position.x;
  const dy = 1.4 - camera.position.y;
  const dz = z - camera.position.z;
  return dx * lookDir.x + dy * lookDir.y + dz * lookDir.z > 0.4;
}

export function D14112026Cam({ soldiers }: { soldiers: number }) {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = d1411Cam(d1411T(), soldiers);
    persp.fov = shot.fov;
    persp.near = 0.12;
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
  const form = d1411Form(soldiers);
  const score = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1600;
    c.height = 200;
    const ctx = c.getContext("2d");
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.generateMipmaps = false;
    map.minFilter = THREE.LinearFilter;
    if (ctx) {
      ctx.clearRect(0, 0, 1600, 200);
      roundRect(ctx, 16, 16, 1568, 168, 24);
      ctx.fillStyle = "rgba(8,4,2,0.82)";
      ctx.fill();
      ctx.strokeStyle = "#ffe14a";
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 64px Inter,sans-serif";
      const line = `${formatCount(form.friends)} savaşçı   VS   ${formatCount(form.foes)} roman`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = "#000";
      ctx.strokeText(line, 800, 100);
      ctx.fillStyle = "#fff4c4";
      ctx.fillText(line, 800, 100);
    }
    return map;
  }, [form.foes, form.friends]);
  useEffect(() => () => {
    tex.dispose();
    score.dispose();
  }, [tex, score]);
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
          const titleFill = cap.accent === "red" ? "#ff4d42" : cap.accent === "gold" ? "#ffe14a" : "#ffffff";
          ctx.font = "900 120px Inter, Segoe UI, sans-serif";
          ctx.lineWidth = 16;
          ctx.strokeStyle = "rgba(0,0,0,0.92)";
          ctx.strokeText(cap.title, 1024, 190);
          ctx.fillStyle = titleFill;
          ctx.fillText(cap.title, 1024, 190);
          ctx.font = "800 58px Inter, Segoe UI, sans-serif";
          ctx.lineWidth = 11;
          ctx.strokeText(cap.sub, 1024, 360);
          ctx.fillStyle = "#f0f2f6";
          ctx.fillText(cap.sub, 1024, 360);
        }
        tex.needsUpdate = true;
      }
    }
    if (plate.current) plate.current.visible = Boolean(cap);
  });
  const w = size.width * 0.94;
  const h = w * (560 / 2048);
  const sw = size.width * 0.86;
  const sh = sw * (200 / 1600);
  return (
    <Hud renderPriority={3}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh ref={plate} position={[0, size.height / 2 - h * 0.52 - 14, 4]} renderOrder={30}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, -size.height / 2 + sh * 0.55 + 12, 3]} renderOrder={28}>
        <planeGeometry args={[sw, sh]} />
        <meshBasicMaterial map={score} transparent depthTest={false} toneMapped={false} />
      </mesh>
    </Hud>
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

function attackClips(clips: THREE.AnimationClip[]) {
  const picked: THREE.AnimationClip[] = [];
  for (const prefix of D1411_ATTACK_PREFIXES) {
    const clip = clips.find((c) => c.name.startsWith(prefix));
    if (clip) picked.push(clip);
  }
  if (!picked.length && clips[0]) picked.push(clips[0]);
  return picked;
}

type HeroMan = {
  i: number;
  hold: THREE.Group;
  mix: THREE.AnimationMixer;
  actions: THREE.AnimationAction[];
  durs: number[];
  clipI: number;
};

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
        const clips = attackClips(heroFile.animations);
        const men: HeroMan[] = [];
        for (let i = 0; i < layout.friends; i++) {
          const model = cloneSkinned(heroFile.scene) as THREE.Group;
          const hold = new THREE.Group();
          hold.add(model);
          root.add(hold);
          const mix = new THREE.AnimationMixer(model);
          const actions: THREE.AnimationAction[] = [];
          const durs: number[] = [];
          for (const clip of clips) {
            const action = mix.clipAction(clip);
            action.enabled = false;
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            actions.push(action);
            durs.push(Math.max(0.3, clip.duration));
          }
          if (actions[0]) {
            actions[0].enabled = true;
            actions[0].play();
          }
          men.push({ i, hold, mix, actions, durs, clipI: 0 });
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

  useFrame(({ camera }) => {
    const t = d1411T();
    for (const man of heroes.current) {
      const p = d1411Knight(layout, man.i, t);
      layout.liveX[man.i] = p.x;
      layout.liveZ[man.i] = p.z;
      const show = p.show && inFront(camera, p.x, p.z);
      man.hold.visible = show;
      man.hold.position.set(p.x, 0, p.z);
      man.hold.rotation.set(p.pitch, p.yaw, p.roll);

      const clipI = Math.max(0, Math.min(man.actions.length - 1, p.clipI));
      if (clipI !== man.clipI) {
        for (let a = 0; a < man.actions.length; a++) {
          const action = man.actions[a];
          if (a === clipI) {
            action.reset();
            action.enabled = true;
            action.play();
          } else {
            action.stop();
            action.enabled = false;
          }
        }
        man.clipI = clipI;
      }
      const dur = man.durs[clipI] ?? 1;
      const action = man.actions[clipI];
      if (action) {
        action.time = Math.min(dur - 0.001, Math.max(0, p.clipTime % dur));
        action.enabled = true;
        man.mix.update(0);
      }
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
      const ahead = dx * lookDir.x + (2.1 - camera.position.y) * lookDir.y + dz * lookDir.z;
      const dist = Math.hypot(dx, camera.position.y - 2.1, dz);
      const hide = ahead < 0.6;
      const want = Math.min(2.2, dist * tanH * 0.55) * 1.05;
      const size = want / 2.9;
      dummy.position.set(x, 2.15, z);
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
