import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { buildKnightSoldier } from "../../knightSoldier";
import { buildNameAtlas, type NameAtlas, type NameCell } from "../../nameAtlas";
import { REEL_HOLD } from "../../recordCanvas";
import { OK_DECK, OK_FOES, OK_FRIENDS, okArrows, okBanner, okCam, okFoe, okFriend, okGiant } from "../../okReel";

const dummy = new THREE.Object3D();
const up = new THREE.Vector3(0, 1, 0);
const dir = new THREE.Vector3();
const spin = new THREE.Quaternion();
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

function creamStone() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#f4e7cf";
  ctx.fillRect(0, 0, 512, 512);
  const tile = 64;
  for (let y = 0; y < 512; y += tile) {
    for (let x = 0; x < 512; x += tile) {
      const n = ((x * 13 + y * 7) % 17) / 17;
      ctx.fillStyle = n < 0.34 ? "#f8edd9" : n < 0.67 ? "#f1e2c6" : "#e6d3ae";
      ctx.fillRect(x + 3, y + 3, tile - 6, tile - 6);
      ctx.strokeStyle = "rgba(126, 98, 62, 0.32)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, tile - 4, tile - 4);
    }
  }
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = i % 2 ? "rgba(92, 70, 42, 0.16)" : "rgba(255, 250, 242, 0.4)";
    ctx.fillRect((i * 47) % 512, (i * 91) % 512, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(OK_DECK.w / 5.2, OK_DECK.d / 6.4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function arrowGeo() {
  const shaft = new THREE.CylinderGeometry(0.03, 0.03, 0.78, 5);
  shaft.translate(0, 0.39, 0);
  const head = new THREE.ConeGeometry(0.075, 0.24, 6);
  head.translate(0, 0.9, 0);
  const geo = mergeGeometries([shaft, head], false);
  shaft.dispose();
  head.dispose();
  return geo;
}

function paintBanner(canvas: HTMLCanvasElement, label: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const round = (x: number, y: number, rw: number, rh: number, r: number) => {
    const rad = Math.min(r, rw / 2, rh / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + rw, y, x + rw, y + rh, rad);
    ctx.arcTo(x + rw, y + rh, x, y + rh, rad);
    ctx.arcTo(x, y + rh, x, y, rad);
    ctx.arcTo(x, y, x + rw, y, rad);
    ctx.closePath();
  };
  round(28, 28, w - 56, h - 56, 36);
  ctx.fillStyle = "rgba(22, 16, 12, 0.88)";
  ctx.fill();
  ctx.lineWidth = 16;
  ctx.strokeStyle = "#ffe14a";
  ctx.stroke();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#c41616";
  ctx.stroke();
  const parts = label.split(" ");
  const num = parts[0] ?? label;
  const word = parts.slice(1).join(" ");
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "900 168px Arial, sans-serif";
  const numW = ctx.measureText(num).width;
  ctx.font = "800 92px Arial, sans-serif";
  const wordW = word ? ctx.measureText(` ${word}`).width : 0;
  let scale = Math.min(1, 900 / Math.max(1, numW + wordW));
  const total = (numW + wordW) * scale;
  let x = (w - total) / 2;
  const y = h / 2 + 6;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.font = "900 168px Arial, sans-serif";
  ctx.fillStyle = "#ffe14a";
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 10;
  ctx.strokeText(num, 0, 0);
  ctx.fillText(num, 0, 0);
  x = numW;
  ctx.font = "800 92px Arial, sans-serif";
  ctx.fillStyle = "#fff4c4";
  ctx.strokeText(` ${word}`, x, 8);
  ctx.fillText(` ${word}`, x, 8);
  ctx.restore();
}

function markDynamic(mesh: THREE.InstancedMesh | null) {
  mesh?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
}

function place(pose: { x: number; y: number; z: number; yaw: number; pitch: number; roll: number; scale: number } | null) {
  dummy.rotation.order = "YXZ";
  if (!pose || pose.scale < 0.02) {
    dummy.position.set(0, -40, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(0);
  } else {
    dummy.position.set(pose.x, pose.y, pose.z);
    dummy.rotation.set(pose.pitch, pose.yaw, pose.roll);
    dummy.scale.setScalar(pose.scale);
  }
  dummy.updateMatrix();
}

export function OkCam() {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera, clock }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = okCam(Math.max(0, clock.elapsedTime - REEL_HOLD));
    persp.fov = shot.fov;
    persp.near = 0.35;
    persp.far = 980;
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

function OkBanner() {
  const size = useThree((s) => s.size);
  const plate = useRef<THREE.Mesh>(null);
  const shown = useRef<string | null>(null);
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 320;
    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame(({ clock }) => {
    const mesh = plate.current;
    if (!mesh) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const label = okBanner(t);
    if (!label) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.scale.setScalar(1 + Math.sin(clock.elapsedTime * 5.4) * 0.045);
    if (shown.current !== label) {
      shown.current = label;
      paintBanner(tex.image as HTMLCanvasElement, label);
      tex.needsUpdate = true;
    }
  });
  const w = size.width * 0.9;
  const h = w * (320 / 1024);
  return (
    <Hud renderPriority={3}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh ref={plate} position={[0, size.height / 2 - h * 0.5 - 36, 4]} visible={false} renderOrder={30}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
      </mesh>
    </Hud>
  );
}

function OkDeck() {
  const tex = useMemo(() => creamStone(), []);
  useEffect(() => () => tex?.dispose(), [tex]);
  return (
    <group>
      <mesh position={[OK_DECK.cx, -1.42, OK_DECK.cz]}>
        <boxGeometry args={[OK_DECK.w + 0.7, 0.42, OK_DECK.d + 0.7]} />
        <meshStandardMaterial color="#cbb892" roughness={0.96} metalness={0} />
      </mesh>
      <mesh position={[OK_DECK.cx, -0.62, OK_DECK.cz]} receiveShadow>
        <boxGeometry args={[OK_DECK.w, 1.24, OK_DECK.d]} />
        <meshStandardMaterial map={tex ?? undefined} color="#fff4e2" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

function OkFighters() {
  const [knight, setKnight] = useState<{ body: THREE.BufferGeometry; helm: THREE.BufferGeometry } | null>(null);
  const [roman, setRoman] = useState<THREE.BufferGeometry | null>(null);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const helmRef = useRef<THREE.InstancedMesh>(null);
  const romanRef = useRef<THREE.InstancedMesh>(null);
  const arrowRef = useRef<THREE.InstancedMesh>(null);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a56e8", roughness: 0.42, metalness: 0.38, envMapIntensity: 0.85 }), []);
  const helmMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e7eef5", roughness: 0.18, metalness: 0.9, envMapIntensity: 1.15 }), []);
  const romanMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.46, metalness: 0.4, envMapIntensity: 0.7 }), []);
  const arrowMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f0d7a2", roughness: 0.45, metalness: 0.15 }), []);
  const arrows = useMemo(() => arrowGeo(), []);

  useEffect(() => {
    let drop = false;
    const loader = new GLTFLoader();
    loader.load("/models/knight.glb", (gltf) => {
      if (drop) return;
      setKnight(buildKnightSoldier(gltf.scene));
    });
    loader.load("/models/roman.glb", (gltf) => {
      const built = buildRoman(gltf.scene);
      if (drop) {
        built?.dispose();
        return;
      }
      setRoman(built);
    });
    return () => {
      drop = true;
    };
  }, []);

  useEffect(() => () => {
    bodyMat.dispose();
    helmMat.dispose();
    romanMat.dispose();
    arrowMat.dispose();
    arrows?.dispose();
  }, [arrowMat, arrows, bodyMat, helmMat, romanMat]);
  useEffect(() => () => {
    knight?.body.dispose();
    knight?.helm.dispose();
  }, [knight]);
  useEffect(() => () => roman?.dispose(), [roman]);
  useLayoutEffect(() => {
    markDynamic(bodyRef.current);
    markDynamic(helmRef.current);
    markDynamic(romanRef.current);
    markDynamic(arrowRef.current);
  }, [knight, roman]);

  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const body = bodyRef.current;
    const helm = helmRef.current;
    if (body && helm) {
      for (let i = 0; i < OK_FRIENDS; i++) {
        place(okFriend(i, t));
        body.setMatrixAt(i, dummy.matrix);
        helm.setMatrixAt(i, dummy.matrix);
      }
      body.instanceMatrix.needsUpdate = true;
      helm.instanceMatrix.needsUpdate = true;
    }
    const foes = romanRef.current;
    if (foes) {
      for (let i = 0; i < OK_FOES; i++) {
        place(okFoe(i, t));
        foes.setMatrixAt(i, dummy.matrix);
      }
      foes.instanceMatrix.needsUpdate = true;
    }
    const volley = arrowRef.current;
    if (!volley) return;
    const shot = okArrows(t);
    for (let i = 0; i < shot.list.length; i++) {
      const a = shot.list[i];
      if (i < shot.n) {
        dir.set(a.dx, a.dy, a.dz);
        if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
        else dir.normalize();
        dummy.position.set(a.x, a.y, a.z);
        spin.setFromUnitVectors(up, dir);
        dummy.quaternion.copy(spin);
        dummy.scale.setScalar(1);
      } else {
        dummy.position.set(0, -40, 0);
        dummy.quaternion.identity();
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      volley.setMatrixAt(i, dummy.matrix);
    }
    volley.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {knight && (
        <>
          <instancedMesh ref={bodyRef} args={[knight.body, bodyMat, OK_FRIENDS]} frustumCulled={false} />
          <instancedMesh ref={helmRef} args={[knight.helm, helmMat, OK_FRIENDS]} frustumCulled={false} />
        </>
      )}
      {roman && <instancedMesh ref={romanRef} args={[roman, romanMat, OK_FOES]} frustumCulled={false} />}
      {arrows && <instancedMesh ref={arrowRef} args={[arrows, arrowMat, 140]} frustumCulled={false} />}
    </group>
  );
}

function OkNames({ names }: { names: string[] }) {
  const labels = useMemo(() => {
    const out: { slot: number; text: string }[] = [];
    const n = Math.min(names.length, OK_FRIENDS);
    for (let i = 0; i < n; i++) {
      const text = String(names[i] ?? "").trim().replace(/^@+/, "");
      if (text) out.push({ slot: i, text });
    }
    return out;
  }, [names]);
  const atlas = useMemo<NameAtlas | null>(() => {
    if (!labels.length) return null;
    const items = labels.map((n) => ({ text: n.text, commander: false, plain: true, fill: "#ffe14a", frame: true }));
    try {
      return buildNameAtlas(items, true);
    } catch {
      return buildNameAtlas(items);
    }
  }, [labels]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const { camera } = useThree();
  useEffect(() => () => atlas?.dispose(), [atlas]);
  useFrame(({ clock }) => {
    if (!atlas) return;
    const persp = camera as THREE.PerspectiveCamera;
    const fov = persp.isPerspectiveCamera ? persp.fov : 60;
    const tanH = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * (1080 / 1920);
    camera.getWorldDirection(lookDir);
    dummy.quaternion.copy(camera.quaternion);
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    for (let k = 0; k < labels.length; k++) {
      const cell: NameCell | undefined = atlas.cells[k];
      const mesh = cell ? refs.current[cell.sheet] : null;
      if (!cell || !mesh) continue;
      const pose = okFriend(labels[k].slot, t);
      const hide = !pose || pose.scale < 0.7 || pose.pitch < -0.35;
      const x = pose?.x ?? 0;
      const z = pose?.z ?? 0;
      const dx = x - camera.position.x;
      const dz = z - camera.position.z;
      const ahead = dx * lookDir.x + (2.4 - camera.position.y) * lookDir.y + dz * lookDir.z;
      const dist = Math.hypot(dx, camera.position.y - 2.4, dz);
      const want = Math.min(1.68 * 1.05, dist * tanH * 0.5) * 1.55 * 0.85;
      const size = want / 2.9;
      const show = !hide && ahead > 2.4;
      dummy.position.set(x, 2.35, z);
      dummy.scale.set(show ? cell.sx * size : 0, show ? cell.sy * size : 0, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(cell.local, dummy.matrix);
    }
    for (const mesh of refs.current) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });
  if (!atlas) return null;
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

const COLOSSUS_URL = "/models/colossus.glb";
const COLOSSUS_HEIGHT = 15.6;
const COLOSSUS_SPAN_Y = 2.711936;
const COLOSSUS_MIN_Y = -1.520994;
const COLOSSUS_CENTER_X = -0.291638;
const COLOSSUS_CENTER_Z = -0.259902;

function colossusSword() {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: "#d7dee6", metalness: 0.92, roughness: 0.22, side: THREE.DoubleSide });
  const wrap = new THREE.MeshStandardMaterial({ color: "#3a3e46", metalness: 0.4, roughness: 0.5 });
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.32, 6), wrap);
  grip.rotation.x = Math.PI / 2;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.08), steel);
  guard.position.z = 0.18;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.028, 1.55), steel);
  blade.position.z = 0.98;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.26, 4), steel);
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 1.86;
  group.add(grip, guard, blade, tip);
  group.position.set(-0.42, -0.64, 0.98);
  group.rotation.x = 0.42;
  return group;
}

function paintHp(canvas: HTMLCanvasElement, hp: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(18, 16, 16, 0.92)";
  ctx.beginPath();
  ctx.roundRect(8, 16, w - 16, h - 32, 18);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#ffe14a";
  ctx.stroke();
  ctx.font = "800 64px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff4c4";
  ctx.fillText("HP", 36, h / 2 + 2);
  const barX = 168;
  const barW = w - barX - 36;
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(barX, 40, barW, h - 80);
  ctx.fillStyle = hp > 0.28 ? "#ff3b30" : "#ffb020";
  ctx.fillRect(barX, 40, Math.max(0, barW * hp), h - 80);
}

function OkColossus() {
  const root = useRef<THREE.Group>(null);
  const rig = useRef<THREE.Group>(null);
  const bar = useRef<THREE.Mesh>(null);
  const shown = useRef(-1);
  const { camera } = useThree();
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 160;
    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    const metal = new THREE.MeshStandardMaterial({ color: "#a7b0b8", metalness: 0.84, roughness: 0.32, side: THREE.DoubleSide });
    const ink = new THREE.MeshStandardMaterial({ color: "#3a3e46", metalness: 0.4, roughness: 0.48, side: THREE.DoubleSide });
    const sword = colossusSword();
    loader.load(COLOSSUS_URL, (gltf) => {
      const host = rig.current;
      if (drop || !host) return;
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.frustumCulled = false;
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const hand = center.z > 0.55 && center.y < 0.65 && center.y > -0.95 && center.x < 0.15;
        const foot = center.y < -0.82 || (center.y < -0.7 && size.y < 0.4 && center.z < 0.55);
        const head = box.min.y > 0.62;
        mesh.material = hand || foot || head ? ink : metal;
      });
      model.add(sword);
      host.add(model);
    });
    return () => {
      drop = true;
      metal.dispose();
      ink.dispose();
      sword.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
      rig.current?.clear();
    };
  }, []);
  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const boss = okGiant(t);
    const body = root.current;
    const plate = bar.current;
    if (!body || !plate) return;
    if (!boss) {
      body.visible = false;
      plate.visible = false;
      return;
    }
    body.visible = true;
    body.position.set(boss.x, boss.y, boss.z);
    body.rotation.order = "YXZ";
    body.rotation.set(boss.pitch, boss.yaw, 0);
    const pct = Math.round(boss.hp * 100);
    plate.visible = boss.fall < 0.45;
    plate.position.set(boss.x, boss.y + 17.2 * (1 - boss.fall * 0.65), boss.z);
    plate.quaternion.copy(camera.quaternion);
    if (shown.current !== pct) {
      shown.current = pct;
      paintHp(tex.image as HTMLCanvasElement, boss.hp);
      tex.needsUpdate = true;
    }
  });
  const scale = COLOSSUS_HEIGHT / COLOSSUS_SPAN_Y;
  return (
    <group>
      <group ref={root}>
        <group ref={rig} scale={scale} position={[-COLOSSUS_CENTER_X * scale, -COLOSSUS_MIN_Y * scale, -COLOSSUS_CENTER_Z * scale]} />
      </group>
      <mesh ref={bar} visible={false} renderOrder={28}>
        <planeGeometry args={[7.2, 1.5]} />
        <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function OkBattle({ names }: { names: string[] }) {
  return (
    <group>
      <OkDeck />
      <OkFighters />
      <OkColossus />
      <OkNames names={names} />
      <OkBanner />
    </group>
  );
}
