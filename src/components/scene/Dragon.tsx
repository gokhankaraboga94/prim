import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { REEL_HOLD } from "../../recordCanvas";
import { SPEAR_HIT, SPEAR_LOOSE, dragonAt, dragonBreathIndex, dragonBreaths, dragonFriendAt, riderAt } from "../../dragonReel";

const DORSAL = new THREE.Color("#8a1e1a");
const BELLY = new THREE.Color("#c45a48");
const HORN = new THREE.Color("#c4b193");
const BONE = new THREE.Color("#3a332b");

type Station = { x: number; y: number; z: number; rx: number; ry: number };

function skinTube(stations: Station[], sides = 16) {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const frames = stations.map((s, i) => {
    const prev = stations[Math.max(0, i - 1)];
    const next = stations[Math.min(stations.length - 1, i + 1)];
    const tangent = new THREE.Vector3(next.x - prev.x, next.y - prev.y, next.z - prev.z).normalize();
    const hint = Math.abs(tangent.y) > 0.92 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(hint, tangent).normalize();
    const up = new THREE.Vector3().crossVectors(tangent, right).normalize();
    return { s, right, up };
  });
  frames.forEach((f, i) => {
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const ridge = Math.pow(Math.max(0, sa), 5) * f.s.ry * 0.35;
      const belly = Math.max(0, -sa);
      const scaleCell = Math.abs(Math.sin(i * 2.15 + k * 0.37)) * (0.35 + 0.65 * Math.abs(Math.cos((k / sides) * Math.PI * 6)));
      const bump = f.s.rx * (0.05 + 0.035 * (1 - belly)) * scaleCell;
      const ox = f.right.x * ca + f.up.x * sa;
      const oy = f.right.y * ca + f.up.y * sa;
      const oz = f.right.z * ca + f.up.z * sa;
      pos.push(
        f.s.x + f.right.x * ca * f.s.rx + f.up.x * (sa * f.s.ry + ridge) + ox * bump,
        f.s.y + f.right.y * ca * f.s.rx + f.up.y * (sa * f.s.ry + ridge) + oy * bump,
        f.s.z + f.right.z * ca * f.s.rx + f.up.z * (sa * f.s.ry + ridge) + oz * bump
      );
      const c = DORSAL.clone().lerp(BELLY, belly * belly * 0.92);
      c.multiplyScalar(0.74 + 0.32 * (1 - scaleCell * (sa > 0 ? 1 : 0.3)));
      if (sa > 0.72) c.multiplyScalar(0.68);
      col.push(c.r, c.g, c.b);
    }
  });
  for (let i = 0; i < stations.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      const a = i * sides + k;
      const b = i * sides + k2;
      const c = (i + 1) * sides + k;
      const d = (i + 1) * sides + k2;
      idx.push(a, b, c, b, d, c);
    }
  }
  const cap = (ring: number, outward: number) => {
    const s = stations[ring];
    const center = pos.length / 3;
    pos.push(s.x, s.y, s.z);
    col.push(BELLY.r * 0.7, BELLY.g * 0.7, BELLY.b * 0.7);
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      if (outward > 0) idx.push(center, ring * sides + k, ring * sides + k2);
      else idx.push(center, ring * sides + k2, ring * sides + k);
    }
  };
  cap(stations.length - 1, 1);
  cap(0, -1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function placed(src: THREE.BufferGeometry, color: THREE.Color, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = src.clone();
  g.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz)
    )
  );
  const n = g.getAttribute("position").count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = color.r;
    col[i * 3 + 1] = color.g;
    col[i * 3 + 2] = color.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function prepMerge(geos: THREE.BufferGeometry[]) {
  for (const g of geos) {
    g.deleteAttribute("uv");
    g.deleteAttribute("uv2");
    if (!g.getAttribute("normal")) g.computeVertexNormals();
  }
  return mergeGeometries(geos, false);
}

function buildBody() {
  const stations: Station[] = [
    { x: 0.05, y: 0.36, z: -8.15, rx: 0.012, ry: 0.01 },
    { x: -0.04, y: 0.32, z: -7.15, rx: 0.03, ry: 0.022 },
    { x: 0.03, y: 0.27, z: -6.15, rx: 0.055, ry: 0.04 },
    { x: 0, y: 0.22, z: -5.15, rx: 0.09, ry: 0.07 },
    { x: 0, y: 0.14, z: -4.1, rx: 0.15, ry: 0.11 },
    { x: 0, y: 0.08, z: -3.1, rx: 0.24, ry: 0.17 },
    { x: 0, y: 0.03, z: -2.1, rx: 0.36, ry: 0.26 },
    { x: 0, y: 0, z: -1.05, rx: 0.5, ry: 0.34 },
    { x: 0, y: -0.02, z: -0.1, rx: 0.62, ry: 0.4 },
    { x: 0, y: 0.04, z: 0.7, rx: 0.52, ry: 0.4 },
    { x: 0, y: 0.22, z: 1.35, rx: 0.4, ry: 0.34 },
    { x: 0, y: 0.5, z: 1.85, rx: 0.3, ry: 0.28 },
    { x: 0, y: 0.72, z: 2.22, rx: 0.24, ry: 0.22 },
  ];
  const tube = skinTube(stations, 12);
  const cone = new THREE.ConeGeometry(0.08, 0.42, 5);
  const extras: THREE.BufferGeometry[] = [tube];
  const onBack = (z: number) => {
    let best = stations[0];
    let bestD = Infinity;
    for (const s of stations) {
      const d = Math.abs(s.z - z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  };
  const spine = [-6.4, -5.2, -4.0, -2.8, -1.6, -0.4, 0.7, 1.5];
  spine.forEach((z, i) => {
    const s = onBack(z);
    const h = 0.1 + (1 - i / spine.length) * 0.12;
    extras.push(placed(cone, new THREE.Color("#16130f"), 0, s.y + s.ry * 0.9 + h * 0.2, z, -0.7, 0, 0, 0.32, h / 0.42, 0.22));
  });
  const fin = new THREE.BoxGeometry(0.55, 0.018, 0.34);
  const tip = onBack(-8.15);
  extras.push(placed(fin, new THREE.Color("#241c16"), 0.16, tip.y, tip.z + 0.02, 0.15, 0.4, 0.7));
  extras.push(placed(fin, new THREE.Color("#241c16"), -0.16, tip.y, tip.z + 0.02, 0.15, -0.4, -0.7));
  fin.dispose();
  const leg = new THREE.CylinderGeometry(0.11, 0.14, 0.5, 7);
  const claw = new THREE.ConeGeometry(0.03, 0.16, 4);
  const hips: Array<[number, number, number]> = [
    [-1, 0.95, -0.85],
    [1, 0.95, -0.85],
    [-1, 1.15, 0.55],
    [1, 1.15, 0.55],
  ];
  hips.forEach(([sign, wide, z]) => {
    extras.push(placed(leg, BONE, sign * 0.28 * wide, -0.05, z, 0.9, 0, sign * 0.45, 1, 1.15, 1));
    extras.push(placed(leg, BONE, sign * 0.48 * wide, -0.28, z - 0.28, 1.5, 0, sign * 0.2, 0.75, 0.95, 0.75));
    extras.push(placed(claw, new THREE.Color("#1c1814"), sign * 0.55 * wide, -0.42, z - 0.48, 1.2, 0, sign * 0.4));
    extras.push(placed(claw, new THREE.Color("#1c1814"), sign * 0.42 * wide, -0.4, z - 0.42, 1.15, 0.4, sign * 0.2, 0.8, 0.8, 0.8));
  });
  const merged = prepMerge(extras);
  cone.dispose();
  leg.dispose();
  claw.dispose();
  if (merged) extras.forEach((g) => g.dispose());
  return merged ?? new THREE.BufferGeometry();
}

function buildSkull() {
  const ball = new THREE.SphereGeometry(0.32, 12, 9);
  const ridge = new THREE.BoxGeometry(0.52, 0.06, 0.14);
  const horn = new THREE.ConeGeometry(0.055, 0.36, 5);
  const parts = [
    placed(ball, DORSAL, 0, 0.1, 0.02, 0, 0, 0, 1.2, 0.88, 1.15),
    placed(ball, DORSAL, 0, -0.02, 0.58, 0.2, 0, 0, 0.58, 0.42, 1.3),
    placed(ball, new THREE.Color("#120e0c"), -0.2, 0.06, 0.24, 0, 0, 0, 0.26, 0.2, 0.18),
    placed(ball, new THREE.Color("#120e0c"), 0.2, 0.06, 0.24, 0, 0, 0, 0.26, 0.2, 0.18),
    placed(ridge, new THREE.Color("#1c1814"), 0, 0.26, 0.2),
    placed(horn, HORN, -0.14, 0.4, -0.02, 0.35, 0, 0.45, 1, 1.15, 1),
    placed(horn, HORN, 0.14, 0.4, -0.02, 0.35, 0, -0.45, 1, 1.15, 1),
    placed(ball, new THREE.Color("#140e0c"), -0.055, -0.05, 0.98, 0, 0, 0, 0.1, 0.07, 0.09),
    placed(ball, new THREE.Color("#140e0c"), 0.055, -0.05, 0.98, 0, 0, 0, 0.1, 0.07, 0.09),
  ];
  const merged = prepMerge(parts);
  ball.dispose();
  ridge.dispose();
  horn.dispose();
  if (merged) parts.forEach((g) => g.dispose());
  return merged ?? new THREE.BufferGeometry();
}

function buildJaw() {
  const stations: Station[] = [
    { x: 0, y: 0, z: 0, rx: 0.2, ry: 0.07 },
    { x: 0, y: -0.02, z: 0.28, rx: 0.16, ry: 0.055 },
    { x: 0, y: -0.03, z: 0.58, rx: 0.1, ry: 0.04 },
    { x: 0, y: -0.02, z: 0.86, rx: 0.035, ry: 0.02 },
  ];
  const tube = skinTube(stations, 10);
  const tooth = new THREE.ConeGeometry(0.02, 0.09, 4);
  const teeth: THREE.BufferGeometry[] = [tube];
  for (let i = 0; i < 6; i++) {
    const z = 0.18 + i * 0.1;
    teeth.push(placed(tooth, new THREE.Color("#f3ead8"), -0.04, 0.04, z, 0, 0, 0));
    teeth.push(placed(tooth, new THREE.Color("#f3ead8"), 0.04, 0.04, z, 0, 0, 0));
  }
  const merged = prepMerge(teeth);
  tooth.dispose();
  if (merged) teeth.forEach((g) => g.dispose());
  return merged ?? new THREE.BufferGeometry();
}

type WingParts = { skin: THREE.BufferGeometry; bone: THREE.BufferGeometry };

function wingGeo(sign: number): WingParts {
  const fingers = [
    [[0, 0.02, 0.05], [sign * 1.05, 0.42, 1.25], [sign * 2.15, 0.22, 2.05], [sign * 3.05, -0.05, 2.45]],
    [[0, 0.02, 0.05], [sign * 1.7, 0.72, 0.45], [sign * 3.6, 0.48, 0.05], [sign * 5.6, 0.05, -0.7]],
    [[0, 0.02, 0.05], [sign * 1.55, 0.42, -0.35], [sign * 3.35, 0.12, -1.15], [sign * 5.15, -0.22, -2.15]],
    [[0, 0.02, 0.05], [sign * 1.05, 0.12, -0.75], [sign * 2.15, -0.12, -1.55], [sign * 3.05, -0.32, -2.25]],
  ];
  const steps = 4;
  const chains = fingers.map((finger) => {
    const pts: number[][] = [];
    for (let i = 0; i < finger.length - 1; i++) {
      for (let s = 0; s < steps; s++) {
        const u = s / steps;
        const a = finger[i];
        const b = finger[i + 1];
        pts.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
      }
    }
    pts.push(finger[finger.length - 1]);
    return pts;
  });
  const between = 2;
  const cols = chains[0].length;
  const rowCount = (chains.length - 1) * between + 1;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let row = 0; row < rowCount; row++) {
    const span = row / (rowCount - 1);
    const f = span * (chains.length - 1);
    const f0 = Math.min(chains.length - 2, Math.floor(f));
    const v = f - f0;
    for (let i = 0; i < cols; i++) {
      const u = i / (cols - 1);
      const a = chains[f0][i];
      const b = chains[f0 + 1][i];
      const sag = Math.sin(v * Math.PI) * Math.sin(u * Math.PI) * 0.22;
      pos.push(a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v - sag, a[2] + (b[2] - a[2]) * v);
    }
  }
  for (let row = 0; row < rowCount - 1; row++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = row * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      if (sign > 0) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const skin = new THREE.BufferGeometry();
  skin.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  skin.setIndex(idx);
  skin.computeVertexNormals();
  const rod = new THREE.CylinderGeometry(0.007, 0.011, 1, 4);
  const spars = [
    placed(rod, BONE, sign * 1.7, 0.28, 0.95, 0.15, 0, sign * 0.55, 1, 3.4, 1),
    placed(rod, BONE, sign * 2.5, 0.22, -0.15, 0.35, 0, sign * 0.72, 1, 4.2, 1),
    placed(rod, BONE, sign * 2.15, 0.02, -1.05, 0.7, 0, sign * 0.62, 1, 3.6, 1),
    placed(rod, BONE, sign * 0.55, 0.16, 0.12, 0.2, 0, sign * 1.05, 0.45, 0.85, 0.45),
  ];
  rod.dispose();
  const bone = prepMerge(spars) ?? new THREE.BufferGeometry();
  if (bone !== spars[0]) spars.forEach((g) => g.dispose());
  return { skin, bone };
}

const flameVert = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const flameFrag = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uStrength;
  uniform float uSeed;
  uniform float uWideAt;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  void main() {
    vec2 uv = vUv;
    float along = mix(uv.y, 1.0 - uv.y, uWideAt);
    float heat = along;
    float t = uTime * 3.4 + uSeed;
    float n = noise(vec2(uv.x * 4.0 + uSeed, heat * 3.2 - t));
    float n2 = noise(vec2(uv.x * 9.0 - t * 0.35, heat * 8.0 - t * 2.1));
    float n3 = noise(vec2(uv.x * 18.0 + t, heat * 14.0 - t * 3.2));
    float x = uv.x - 0.5 + (n - 0.5) * 0.08 * (1.0 - heat);
    float pinch = mix(0.5, 0.045, pow(heat, 0.55));
    pinch *= 0.72 + n2 * 0.55;
    float edge = smoothstep(pinch, pinch * 0.22, abs(x));
    float tongue = smoothstep(0.55, 0.95, n3);
    float body = edge * (0.55 + 0.45 * tongue);
    body *= 1.0 - smoothstep(0.82, 1.0, heat) * 0.25;
    float core = smoothstep(pinch * 0.45, 0.0, abs(x)) * smoothstep(0.05, 0.85, heat);
    vec3 col = mix(vec3(0.55, 0.08, 0.015), vec3(1.0, 0.45, 0.05), smoothstep(0.0, 0.55, heat));
    col = mix(col, vec3(1.0, 0.96, 0.82), core * smoothstep(0.4, 1.0, heat));
    col = mix(col, vec3(0.35, 0.06, 0.02), (1.0 - heat) * (1.0 - edge) * 0.65);
    float alpha = body * uStrength * (0.55 + 0.45 * n2);
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

function makeFlameMaterial(seed: number, wideAt = 0) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: 0 },
      uSeed: { value: seed },
      uWideAt: { value: wideAt },
    },
    vertexShader: flameVert,
    fragmentShader: flameFrag,
  });
}

function GroundFire({ ax, az, t0, dur, armed, radius }: { ax: number; az: number; t0: number; dur: number; armed: boolean; radius: number }) {
  const scorch = useRef<THREE.MeshBasicMaterial>(null);
  const mat = useMemo(() => makeFlameMaterial(ax * 0.17 + az), [ax, az]);
  const tongues = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        x: Math.sin(i * 1.7) * radius * (0.22 + (i % 3) * 0.1),
        z: Math.cos(i * 1.3) * radius * (0.18 + (i % 4) * 0.08),
        yaw: i * 0.9,
        h: radius * (0.42 + (i % 3) * 0.22),
        w: radius * (0.22 + (i % 2) * 0.1),
      })),
    [radius]
  );
  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const u = (t - t0) / dur;
    const live = armed && u > 0 && u < 1 ? Math.sin(Math.min(1, Math.max(0, u)) * Math.PI) : 0;
    const after = armed && t > t0 + dur && t < t0 + dur + 2.4 ? 1 - (t - t0 - dur) / 2.4 : 0;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uStrength.value = Math.max(live, after * 0.45);
    if (scorch.current) {
      const burn = armed && t > t0 ? Math.min(0.78, ((t - t0) / 0.7) * 0.78) : 0;
      scorch.current.opacity = burn;
    }
  });
  return (
    <group position={[ax, 0.05, az]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 22]} />
        <meshBasicMaterial ref={scorch} color="#120c08" transparent opacity={0} depthWrite={false} />
      </mesh>
      {tongues.map((tongue, i) => (
        <mesh key={i} material={mat} position={[tongue.x, tongue.h * 0.5, tongue.z]} rotation={[0, tongue.yaw, 0]}>
          <planeGeometry args={[tongue.w, tongue.h]} />
        </mesh>
      ))}
    </group>
  );
}

const EMBER_N = 20;

function Drake({
  index,
  soldiers,
  body,
  jawGeo,
  wings,
  bodyMat,
}: {
  index: number;
  soldiers: number;
  body: THREE.BufferGeometry | null;
  jawGeo: THREE.BufferGeometry | null;
  wings: readonly [WingParts, WingParts];
  bodyMat: THREE.Material;
}) {
  const root = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const mouthAnchor = useRef<THREE.Object3D>(null);
  const flame = useRef<THREE.Group>(null);
  const embers = useRef<THREE.InstancedMesh>(null);
  const smoke = useRef<THREE.InstancedMesh>(null);
  const mouth = useRef<THREE.PointLight>(null);
  const ground = useRef<THREE.PointLight>(null);
  const emberDummy = useMemo(() => new THREE.Object3D(), []);
  const flameMat = useMemo(() => makeFlameMaterial(1.4 + index * 0.7, 1), [index]);
  const mouthPos = useMemo(() => new THREE.Vector3(), []);
  const aimPos = useMemo(() => new THREE.Vector3(), []);
  const aimDir = useMemo(() => new THREE.Vector3(), []);
  const aimUp = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const scale = 1.88;
  const skull = useMemo(() => buildSkull(), []);
  const skinMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#9a3028",
        transparent: true,
        opacity: 0.3,
        roughness: 0.74,
        metalness: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );
  const boneMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#5c5144", roughness: 0.62, metalness: 0.08 }),
    []
  );

  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const p = dragonAt(t, index, soldiers);
    const idx = dragonBreathIndex(t, index, soldiers);
    const breath = idx >= 0 ? p.breath : 0;
    flameMat.uniforms.uTime.value = t;
    flameMat.uniforms.uStrength.value = breath;
    if (root.current) {
      root.current.position.set(p.x, p.y + Math.sin(t * 2.1 + index) * 0.18 * (1 - breath), p.z);
      root.current.rotation.set(p.pitch, p.yaw, p.roll);
      root.current.updateMatrixWorld(true);
    }
    const hurt = t > SPEAR_HIT;
    const gliding = breath > 0.25 && !hurt;
    const phase = t * (hurt ? 7.4 : gliding ? 1.6 : 4.2) + index;
    const wave = Math.sin(phase);
    const flap = wave < 0 ? wave * 1.15 : wave * 0.72;
    const amp = hurt ? 0.58 : gliding ? 0.1 : 0.32;
    if (left.current) {
      left.current.rotation.z = 0.58 + flap * amp;
      left.current.rotation.x = -0.16;
    }
    if (right.current) {
      right.current.rotation.z = -0.58 - flap * amp;
      right.current.rotation.x = -0.16;
    }
    const neck = Math.sin(t * 1.25 + index) * 0.05;
    if (jaw.current) jaw.current.rotation.x = -0.16 - breath * 0.72;
    if (eyes.current) eyes.current.position.x = neck;
    if (flame.current && mouthAnchor.current) {
      mouthAnchor.current.getWorldPosition(mouthPos);
      aimPos.set(p.aimX, 0.15, p.aimZ);
      aimDir.copy(aimPos).sub(mouthPos);
      const dist = Math.max(0.5, aimDir.length());
      aimDir.multiplyScalar(1 / dist);
      flame.current.visible = breath > 0.04;
      flame.current.position.copy(mouthPos);
      flame.current.quaternion.setFromUnitVectors(aimUp, aimDir);
      const width = p.aimR * 2.15;
      flame.current.scale.set(width, dist, width);
    }
    if (mouth.current) mouth.current.intensity = breath * 18;
    if (ground.current) {
      ground.current.intensity = breath * 22;
      ground.current.position.set(p.aimX, 1.4, p.aimZ);
    }
    const mesh = embers.current;
    if (mesh) {
      for (let i = 0; i < EMBER_N; i++) {
        const speed = 1.35 + (i % 7) * 0.16;
        const u = (t * speed + i * 0.137) % 1;
        if (breath < 0.04) emberDummy.scale.setScalar(0);
        else {
          const spread = (((i * 17) % 11) - 5) * (0.008 + u * u * 0.07);
          const side = Math.sin(t * 11 + i * 1.3) * (0.01 + u * 0.045);
          emberDummy.position.set(spread, 0.03 + u * 0.94, side);
          emberDummy.rotation.set(u * 2, 0, 0);
          const w = (1 - u * 0.35) * (0.05 + (i % 5) * 0.012) * (0.35 + breath);
          emberDummy.scale.set(w, w * 0.12, w);
        }
        emberDummy.updateMatrix();
        mesh.setMatrixAt(i, emberDummy.matrix);
      }
      if (!mesh.userData.painted) {
        for (let i = 0; i < EMBER_N; i++) {
          const hot = 1 - (i % 10) / 10;
          mesh.setColorAt(i, new THREE.Color().setRGB(1, 0.45 + hot * 0.5, 0.15 * hot));
        }
        mesh.userData.painted = true;
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    const sm = smoke.current;
    if (sm) {
      for (let i = 0; i < 8; i++) {
        const u = (t * (0.55 + (i % 4) * 0.08) + i * 0.2) % 1;
        if (breath < 0.05) emberDummy.scale.setScalar(0);
        else {
          emberDummy.position.set((((i * 5) % 7) - 3) * 0.08 * u, 0.15 + u * 0.8, (((i * 3) % 5) - 2) * 0.05);
          const w = u * (0.12 + breath * 0.16) * (1 - u * 0.25);
          emberDummy.scale.set(Math.max(0, w), Math.max(0, w * 0.15), Math.max(0, w));
        }
        emberDummy.updateMatrix();
        sm.setMatrixAt(i, emberDummy.matrix);
      }
      sm.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <group ref={root} scale={scale}>
        {body && <mesh geometry={body} material={bodyMat} />}
        <group ref={eyes} position={[0, 0.7, 2.08]}>
          {skull && <mesh geometry={skull} material={bodyMat} />}
          {([-1, 1] as const).map((side) => (
            <group key={side} position={[side * 0.2, 0.07, 0.32]}>
              <mesh>
                <sphereGeometry args={[0.048, 10, 8]} />
                <meshStandardMaterial color="#c6a15a" roughness={0.28} metalness={0.12} />
              </mesh>
              <mesh position={[0, 0, 0.03]} scale={[0.7, 0.22, 0.35]}>
                <sphereGeometry args={[0.028, 6, 4]} />
                <meshBasicMaterial color="#140c08" />
              </mesh>
            </group>
          ))}
          <group ref={jaw} position={[0, -0.12, 0.42]}>
            {jawGeo && (
              <mesh geometry={jawGeo}>
                <meshStandardMaterial vertexColors roughness={0.88} metalness={0.02} />
              </mesh>
            )}
            <mesh position={[0, 0.02, 0.2]}>
              <boxGeometry args={[0.18, 0.06, 0.4]} />
              <meshBasicMaterial color="#14080a" />
            </mesh>
          </group>
        </group>
        <object3D ref={mouthAnchor} position={[0, 0.58, 3.12]} />
        <group ref={left} position={[0.42, 0.38, 0.85]}>
          <mesh geometry={wings[0].bone} material={boneMat} />
          <mesh geometry={wings[0].skin} material={skinMat} renderOrder={2} />
        </group>
        <group ref={right} position={[-0.42, 0.38, 0.85]}>
          <mesh geometry={wings[1].bone} material={boneMat} />
          <mesh geometry={wings[1].skin} material={skinMat} renderOrder={2} />
        </group>
      </group>
      <group ref={flame}>
        {[0, 0.55, -0.55, 1.15, -1.15].map((spin) => (
          <mesh key={spin} material={flameMat} position={[0, 0.5, 0]} rotation={[0, spin, 0]}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        ))}
        <mesh material={flameMat} position={[0, 0.38, 0]} rotation={[0, 0.3, 0]}>
          <planeGeometry args={[0.34, 0.62]} />
        </mesh>
        <instancedMesh ref={embers} args={[undefined, undefined, EMBER_N]}>
          <sphereGeometry args={[0.16, 5, 4]} />
          <meshBasicMaterial color="#ffb020" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
        </instancedMesh>
        <instancedMesh ref={smoke} args={[undefined, undefined, 8]}>
          <sphereGeometry args={[0.45, 6, 5]} />
          <meshBasicMaterial color="#2a241e" transparent opacity={0.22} depthWrite={false} />
        </instancedMesh>
        <pointLight ref={mouth} color="#ff8a32" intensity={0} distance={16} decay={2} />
      </group>
      <pointLight ref={ground} color="#ff5a12" intensity={0} distance={14} decay={2} />
    </group>
  );
}

const REPLY_BOWS = 80;
const REPLY_ARROWS = 32;

function makeReplyBow() {
  const arc = new THREE.TorusGeometry(0.36, 0.014, 4, 10, Math.PI * 1.25);
  arc.rotateY(Math.PI / 2);
  arc.translate(0.08, 1.16, 0.28);
  return arc;
}

function makeReplyArrow() {
  const shaft = new THREE.CylinderGeometry(0.012, 0.012, 0.74, 4);
  const head = new THREE.ConeGeometry(0.028, 0.13, 4);
  head.translate(0, 0.42, 0);
  const parts = [shaft, head];
  const merged = prepMerge(parts);
  if (merged) parts.forEach((g) => g.dispose());
  return merged ?? new THREE.BufferGeometry();
}

function Reply({ soldiers }: { soldiers: number }) {
  const bows = useRef<THREE.InstancedMesh>(null);
  const arrows = useRef<THREE.InstancedMesh>(null);
  const bowGeo = useMemo(() => makeReplyBow(), []);
  const arrowGeo = useMemo(() => makeReplyArrow(), []);
  const pose = useMemo(() => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, blood: 0 }), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const start = useMemo(() => new THREE.Vector3(), []);
  const end = useMemo(() => new THREE.Vector3(), []);
  const spin = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(), []);

  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const n = Math.max(1, soldiers);
    const bowMesh = bows.current;
    const arrowMesh = arrows.current;
    if (!bowMesh || !arrowMesh) return;
    const stride = Math.max(1, Math.ceil(n / REPLY_BOWS));
    let bowN = 0;
    let arrowN = 0;
    for (let i = 0; i < n && bowN < REPLY_BOWS; i += stride) {
      dragonFriendAt(i, n, t, pose);
      if ((pose.s ?? 1) <= 0 || pose.blood) continue;
      dummy.position.set(pose.x, pose.y, pose.z);
      dummy.rotation.set(pose.rx, pose.ry, pose.rz);
      dummy.scale.setScalar(1.23);
      dummy.updateMatrix();
      bowMesh.setMatrixAt(bowN, dummy.matrix);
      bowN += 1;
      if (t < 3.4 || arrowN >= REPLY_ARROWS) continue;
      const period = 2.05;
      const phase = ((i * 17) % 100) / 100;
      const u = (t / period + phase) % 1;
      const since = (u - 0.56) * period;
      const flight = 1.08;
      if (since < 0 || since > flight) continue;
      const looseT = t - since;
      dragonFriendAt(i, n, looseT, pose);
      if ((pose.s ?? 1) <= 0 || pose.blood) continue;
      euler.set(pose.rx, pose.ry, pose.rz);
      spin.setFromEuler(euler);
      start.set(0.08, 1.32, 0.42).applyQuaternion(spin).multiplyScalar(1.23);
      start.x += pose.x;
      start.y += pose.y;
      start.z += pose.z;
      const arrive = looseT + flight * 0.7;
      let best = 1e12;
      let aimX = pose.x;
      let aimY = 16;
      let aimZ = pose.z + 6;
      for (let d = 0; d < 1; d++) {
        const drake = dragonAt(arrive, d, n);
        const dx = drake.x - pose.x;
        const dz = drake.z - pose.z;
        const dist = dx * dx + dz * dz;
        if (dist < best) {
          best = dist;
          aimX = drake.x;
          aimY = drake.y + 0.4;
          aimZ = drake.z;
        }
      }
      const fly = since / flight;
      end.set(aimX, aimY, aimZ);
      dummy.position.set(
        start.x + (end.x - start.x) * fly,
        start.y + (end.y - start.y) * fly + Math.sin(fly * Math.PI) * 2.4,
        start.z + (end.z - start.z) * fly
      );
      dummy.lookAt(end.x, end.y, end.z);
      dummy.rotateX(Math.PI / 2);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      arrowMesh.setMatrixAt(arrowN, dummy.matrix);
      arrowN += 1;
    }
    bowMesh.count = bowN;
    arrowMesh.count = arrowN;
    bowMesh.instanceMatrix.needsUpdate = true;
    arrowMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bows} args={[bowGeo, undefined, REPLY_BOWS]} frustumCulled={false} count={0}>
        <meshStandardMaterial color="#6a4228" roughness={0.72} metalness={0.04} />
      </instancedMesh>
      <instancedMesh ref={arrows} args={[arrowGeo, undefined, REPLY_ARROWS]} frustumCulled={false} count={0}>
        <meshStandardMaterial color="#d7c7a2" roughness={0.55} metalness={0.08} />
      </instancedMesh>
    </group>
  );
}

function buildHorseBody() {
  const coat = new THREE.Color("#6a4630");
  const dark = new THREE.Color("#2c1c14");
  const barrel = new THREE.CylinderGeometry(0.28, 0.3, 1.15, 8);
  barrel.rotateX(Math.PI / 2);
  const ball = new THREE.SphereGeometry(0.3, 8, 6);
  const neck = new THREE.CylinderGeometry(0.1, 0.15, 0.58, 6);
  const head = new THREE.SphereGeometry(0.16, 8, 6);
  const muzzle = new THREE.CylinderGeometry(0.065, 0.085, 0.26, 6);
  const ear = new THREE.ConeGeometry(0.035, 0.14, 4);
  const mane = new THREE.BoxGeometry(0.045, 0.1, 0.42);
  const tail = new THREE.ConeGeometry(0.055, 0.62, 5);
  const parts = [
    placed(barrel, coat, 0, 1.18, 0),
    placed(ball, coat, 0, 1.2, 0.42, 0, 0, 0, 0.85, 0.9, 0.7),
    placed(ball, coat, 0, 1.22, -0.42, 0, 0, 0, 0.9, 0.95, 0.72),
    placed(neck, coat, 0, 1.55, 0.72, 0.7, 0, 0),
    placed(head, coat, 0, 1.86, 0.98, 0, 0, 0, 0.7, 0.75, 1.05),
    placed(muzzle, coat, 0, 1.78, 1.18, Math.PI / 2, 0, 0),
    placed(ear, dark, -0.07, 2.02, 0.96, -0.2, 0, -0.3),
    placed(ear, dark, 0.07, 2.02, 0.96, -0.2, 0, 0.3),
    placed(mane, dark, 0, 1.68, 0.78, 0.7, 0, 0),
    placed(tail, dark, 0, 1.05, -0.72, 0.5, 0, 0),
    placed(ball, dark, 0, 1.46, -0.05, 0, 0, 0, 0.35, 0.12, 0.28),
  ];
  const merged = prepMerge(parts);
  barrel.dispose();
  ball.dispose();
  neck.dispose();
  head.dispose();
  muzzle.dispose();
  ear.dispose();
  mane.dispose();
  tail.dispose();
  if (merged) parts.forEach((g) => g.dispose());
  return merged ?? new THREE.BufferGeometry();
}

function Lancer({ soldiers }: { soldiers: number }) {
  const horse = useRef<THREE.Group>(null);
  const fl = useRef<THREE.Group>(null);
  const fr = useRef<THREE.Group>(null);
  const hl = useRef<THREE.Group>(null);
  const hr = useRef<THREE.Group>(null);
  const spear = useRef<THREE.Group>(null);
  const wound = useRef<THREE.Mesh>(null);
  const from = useMemo(() => new THREE.Vector3(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const locked = useRef(false);
  const horseBody = useMemo(() => buildHorseBody(), []);

  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const ride = riderAt(t);
    const bob = Math.abs(Math.sin(t * 13)) * 0.06 * ride.gallop;
    if (horse.current) {
      horse.current.position.set(ride.x, bob, ride.z);
      horse.current.rotation.y = ride.yaw;
    }
    const swing = Math.sin(t * 13) * 0.72 * ride.gallop;
    if (fl.current) fl.current.rotation.x = swing;
    if (fr.current) fr.current.rotation.x = -swing;
    if (hl.current) hl.current.rotation.x = -swing * 0.8;
    if (hr.current) hr.current.rotation.x = swing * 0.8;

    const drake = dragonAt(t, 0, soldiers);
    euler.set(drake.pitch, drake.yaw, drake.roll);
    hit.set(-1.15, 0.2, 0.1).multiplyScalar(1.88).applyEuler(euler);
    hit.x += drake.x;
    hit.y += drake.y;
    hit.z += drake.z;
    if (spear.current) {
      if (t < SPEAR_LOOSE) {
        locked.current = false;
        const wind = Math.max(0, Math.min(1, (t - (SPEAR_LOOSE - 0.8)) / 0.8));
        euler.set(0, ride.yaw, 0);
        from.set(0.46, 2.15, 0.55).applyEuler(euler);
        from.x += ride.x;
        from.y += bob;
        from.z += ride.z;
        spear.current.position.copy(from);
        spear.current.rotation.set(-0.55 - wind * 1.15, ride.yaw, 0.2);
      } else if (t < SPEAR_HIT) {
        if (!locked.current) {
          locked.current = true;
          from.copy(spear.current.position);
        }
        const u = (t - SPEAR_LOOSE) / (SPEAR_HIT - SPEAR_LOOSE);
        const e = u * u * (3 - 2 * u);
        spear.current.position.lerpVectors(from, hit, e);
        spear.current.lookAt(hit.x, hit.y, hit.z);
        spear.current.rotateX(Math.PI / 2);
      } else {
        spear.current.position.copy(hit);
        spear.current.rotation.set(drake.pitch, drake.yaw, drake.roll + 1.2);
      }
    }
    if (wound.current) {
      wound.current.visible = t >= SPEAR_HIT;
      wound.current.position.copy(hit);
    }
  });

  return (
    <group>
      <group ref={horse}>
        <mesh geometry={horseBody}>
          <meshLambertMaterial vertexColors />
        </mesh>
        {(
          [
            [fl, -0.16, 0.42],
            [fr, 0.16, 0.42],
            [hl, -0.16, -0.46],
            [hr, 0.16, -0.46],
          ] as const
        ).map(([ref, x, z]) => (
          <group key={`${x}-${z}`} ref={ref} position={[x, 1.08, z]}>
            <mesh position={[0, -0.26, 0]}>
              <cylinderGeometry args={[0.05, 0.065, 0.5, 6]} />
              <meshLambertMaterial color="#5a3c28" />
            </mesh>
            <mesh position={[0, -0.68, 0.03]}>
              <cylinderGeometry args={[0.038, 0.048, 0.42, 5]} />
              <meshLambertMaterial color="#4a3220" />
            </mesh>
            <mesh position={[0, -0.92, 0.05]}>
              <boxGeometry args={[0.07, 0.05, 0.11]} />
              <meshLambertMaterial color="#1c140e" />
            </mesh>
          </group>
        ))}
        <group position={[0, 1.58, -0.02]}>
          <mesh position={[0, 0.32, 0]}>
            <boxGeometry args={[0.42, 0.5, 0.24]} />
            <meshLambertMaterial color="#2f74ff" />
          </mesh>
          <mesh position={[0, 0.66, 0.02]}>
            <boxGeometry args={[0.22, 0.2, 0.2]} />
            <meshLambertMaterial color="#e4ebf2" />
          </mesh>
          <mesh position={[0, 0.82, 0]}>
            <coneGeometry args={[0.12, 0.16, 5]} />
            <meshLambertMaterial color="#d7c56a" />
          </mesh>
          <mesh position={[0, 0.96, -0.02]}>
            <boxGeometry args={[0.06, 0.22, 0.06]} />
            <meshLambertMaterial color="#f2f4f7" />
          </mesh>
          <mesh position={[0.24, 0.38, 0.18]} rotation={[0.7, 0, -0.35]}>
            <boxGeometry args={[0.09, 0.46, 0.09]} />
            <meshLambertMaterial color="#2f74ff" />
          </mesh>
        </group>
      </group>
      <group ref={spear}>
        <mesh>
          <cylinderGeometry args={[0.03, 0.035, 2.35, 5]} />
          <meshLambertMaterial color="#c4a56a" />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <coneGeometry args={[0.07, 0.26, 5]} />
          <meshLambertMaterial color="#d5dbe2" />
        </mesh>
      </group>
      <mesh ref={wound} visible={false}>
        <sphereGeometry args={[0.28, 8, 6]} />
        <meshBasicMaterial color="#6e120e" />
      </mesh>
    </group>
  );
}

export function Dragon({ soldiers }: { soldiers: number }) {
  const n = Math.max(1, Math.floor(soldiers));
  const body = useMemo(() => buildBody(), []);
  const jawGeo = useMemo(() => buildJaw(), []);
  const wings = useMemo(() => [wingGeo(1), wingGeo(-1)] as const, []);
  const timeU = useRef<THREE.IUniform | null>(null);
  const bodyMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.02 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      timeU.current = shader.uniforms.uTime;
      if (!shader.vertexShader.includes("uniform float uTime")) {
        shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`;
      }
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
  float tailW = smoothstep(-0.6, -7.8, transformed.z);
  float neckW = smoothstep(1.4, 2.3, transformed.z);
  transformed.x += sin(uTime * 2.2 + transformed.z * 0.8) * tailW * 1.05;
  transformed.y += cos(uTime * 1.6 + transformed.z * 0.5) * tailW * 0.32;
  transformed.x += sin(uTime * 1.25) * neckW * 0.07;
  transformed.y += sin(uTime * 1.6 + 0.4) * neckW * 0.05;`,
      );
    };
    return m;
  }, []);

  useFrame(({ clock }) => {
    if (timeU.current) timeU.current.value = Math.max(0, clock.elapsedTime - REEL_HOLD);
  });

  return (
    <group>
      <Drake index={0} soldiers={n} body={body} jawGeo={jawGeo} wings={wings} bodyMat={bodyMat} />
      {dragonBreaths(n).map((b, i) => (
        <GroundFire key={i} ax={b.ax} az={b.az} t0={b.t0} dur={b.dur} armed radius={b.r} />
      ))}
      <Reply soldiers={n} />
      <Lancer soldiers={n} />
    </group>
  );
}
