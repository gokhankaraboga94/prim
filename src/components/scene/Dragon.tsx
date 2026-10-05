import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { REEL_HOLD } from "../../recordCanvas";
import { SPEAR_HIT, SPEAR_LOOSE, dragonAt, dragonBreathIndex, dragonBreaths, dragonFriendAt, dragonIsArcher, riderAt } from "../../dragonReel";

const DORSAL = new THREE.Color("#8a1e1a");
const BELLY = new THREE.Color("#c45a48");
const HORN = new THREE.Color("#c4b193");
const BONE = new THREE.Color("#3a332b");

type Station = { x: number; y: number; z: number; rx: number; ry: number };

function skinTube(stations: Station[], sides = 16, dorsal: THREE.Color = DORSAL, belly: THREE.Color = BELLY, ridgeAmt = 0.35, bumpAmt = 1) {
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
      const ridge = Math.pow(Math.max(0, sa), 5) * f.s.ry * ridgeAmt;
      const bellyMix = Math.max(0, -sa);
      const scaleCell = Math.abs(Math.sin(i * 2.15 + k * 0.37)) * (0.35 + 0.65 * Math.abs(Math.cos((k / sides) * Math.PI * 6)));
      const bump = f.s.rx * (0.05 + 0.035 * (1 - bellyMix)) * scaleCell * bumpAmt;
      const ox = f.right.x * ca + f.up.x * sa;
      const oy = f.right.y * ca + f.up.y * sa;
      const oz = f.right.z * ca + f.up.z * sa;
      pos.push(
        f.s.x + f.right.x * ca * f.s.rx + f.up.x * (sa * f.s.ry + ridge) + ox * bump,
        f.s.y + f.right.y * ca * f.s.rx + f.up.y * (sa * f.s.ry + ridge) + oy * bump,
        f.s.z + f.right.z * ca * f.s.rx + f.up.z * (sa * f.s.ry + ridge) + oz * bump
      );
      const c = dorsal.clone().lerp(belly, bellyMix * bellyMix * 0.92);
      c.multiplyScalar(0.74 + 0.32 * (1 - scaleCell * bumpAmt * (sa > 0 ? 1 : 0.3)));
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
    col.push(belly.r * 0.7, belly.g * 0.7, belly.b * 0.7);
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
    { x: 0.04, y: 0.2, z: -11.2, rx: 0.02, ry: 0.015 },
    { x: -0.05, y: 0.18, z: -9.4, rx: 0.04, ry: 0.028 },
    { x: 0.04, y: 0.16, z: -7.6, rx: 0.07, ry: 0.045 },
    { x: -0.02, y: 0.14, z: -5.8, rx: 0.12, ry: 0.075 },
    { x: 0, y: 0.1, z: -4.0, rx: 0.2, ry: 0.13 },
    { x: 0, y: 0.04, z: -2.3, rx: 0.32, ry: 0.21 },
    { x: 0, y: 0, z: -0.7, rx: 0.44, ry: 0.3 },
    { x: 0, y: 0.04, z: 0.55, rx: 0.4, ry: 0.28 },
    { x: 0, y: 0.14, z: 1.4, rx: 0.22, ry: 0.16 },
    { x: 0, y: 0.36, z: 1.95, rx: 0.14, ry: 0.11 },
    { x: 0, y: 0.66, z: 2.35, rx: 0.12, ry: 0.095 },
    { x: 0, y: 1.0, z: 2.68, rx: 0.1, ry: 0.085 },
  ];
  const tube = skinTube(stations, 12);
  const cone = new THREE.ConeGeometry(0.07, 0.42, 5);
  const extras: THREE.BufferGeometry[] = [tube];
  stations.forEach((s, i) => {
    if (i < 1 || i > stations.length - 2) return;
    const h = 0.05 + s.ry * 1.25;
    extras.push(placed(cone, new THREE.Color("#4a1410"), s.x, s.y + s.ry * 0.9 + h * 0.3, s.z, -0.5, 0, 0, 0.2, h / 0.42, 0.12));
  });
  const thigh = new THREE.CylinderGeometry(0.09, 0.12, 0.62, 7);
  const shin = new THREE.CylinderGeometry(0.05, 0.07, 0.55, 6);
  const claw = new THREE.ConeGeometry(0.028, 0.16, 4);
  ([-1, 1] as const).forEach((sign) => {
    extras.push(placed(thigh, new THREE.Color("#6a221c"), sign * 0.2, -0.04, -0.45, 0.8, 0, sign * 0.12, 1.15, 1.15, 1.15));
    extras.push(placed(shin, new THREE.Color("#4a1612"), sign * 0.32, -0.4, -0.85, 1.25, 0, sign * 0.04, 0.85, 1.1, 0.85));
    extras.push(placed(claw, new THREE.Color("#1a0c08"), sign * 0.38, -0.62, -1.2, 1.15, 0, sign * 0.1));
    extras.push(placed(claw, new THREE.Color("#1a0c08"), sign * 0.24, -0.58, -1.08, 1.1, 0.35, sign * 0.15, 0.7, 0.7, 0.7));
  });
  thigh.dispose();
  shin.dispose();
  const merged = prepMerge(extras);
  cone.dispose();
  claw.dispose();
  if (merged) extras.forEach((g) => g.dispose());
  return merged ?? new THREE.BufferGeometry();
}

function buildSkull() {
  const stations: Station[] = [
    { x: 0, y: 0.02, z: -0.2, rx: 0.13, ry: 0.11 },
    { x: 0, y: 0.12, z: 0.05, rx: 0.22, ry: 0.17 },
    { x: 0, y: 0.06, z: 0.38, rx: 0.16, ry: 0.1 },
    { x: 0, y: -0.02, z: 0.72, rx: 0.1, ry: 0.05 },
    { x: 0, y: -0.03, z: 1.02, rx: 0.04, ry: 0.022 },
  ];
  const tube = skinTube(stations, 12);
  const horn = new THREE.ConeGeometry(0.038, 0.46, 5);
  const pit = new THREE.SphereGeometry(0.028, 6, 4);
  const parts = [
    tube,
    placed(horn, HORN, -0.06, 0.32, -0.02, -1.05, 0.15, 0.35, 0.75, 1.45, 0.75),
    placed(horn, HORN, 0.06, 0.32, -0.02, -1.05, -0.15, -0.35, 0.75, 1.45, 0.75),
    placed(horn, HORN, -0.14, 0.2, 0.08, -0.7, 0.45, 0.85, 0.5, 1.05, 0.5),
    placed(horn, HORN, 0.14, 0.2, 0.08, -0.7, -0.45, -0.85, 0.5, 1.05, 0.5),
    placed(horn, HORN, 0, 0.28, 0.12, -0.85, 0, 0, 0.4, 0.85, 0.4),
    placed(pit, new THREE.Color("#140808"), -0.035, -0.02, 0.9),
    placed(pit, new THREE.Color("#140808"), 0.035, -0.02, 0.9),
  ];
  const merged = prepMerge(parts);
  horn.dispose();
  pit.dispose();
  if (merged) parts.forEach((g) => g.dispose());
  return merged ?? new THREE.BufferGeometry();
}

function buildJaw() {
  const stations: Station[] = [
    { x: 0, y: 0.01, z: 0.02, rx: 0.15, ry: 0.045 },
    { x: 0, y: -0.015, z: 0.32, rx: 0.1, ry: 0.032 },
    { x: 0, y: -0.02, z: 0.58, rx: 0.04, ry: 0.016 },
  ];
  const tube = skinTube(stations, 10);
  const tooth = new THREE.ConeGeometry(0.018, 0.07, 4);
  const teeth: THREE.BufferGeometry[] = [tube];
  for (let i = 0; i < 5; i++) {
    const z = 0.08 + i * 0.09;
    teeth.push(placed(tooth, new THREE.Color("#f3ead8"), -0.045, 0.03, z, -0.4, 0, 0.15));
    teeth.push(placed(tooth, new THREE.Color("#f3ead8"), 0.045, 0.03, z, -0.4, 0, -0.15));
  }
  const merged = prepMerge(teeth);
  tooth.dispose();
  if (merged) teeth.forEach((g) => g.dispose());
  return merged ?? new THREE.BufferGeometry();
}

type WingParts = { skin: THREE.BufferGeometry; bone: THREE.BufferGeometry };

function wingGeo(sign: number): WingParts {
  const fingers = [
    [[0, 0.06, 0.2], [sign * 0.85, 0.72, 0.15], [sign * 1.7, 0.42, -0.7], [sign * 2.45, 0.05, -1.85]],
    [[0, 0.02, 0], [sign * 1.15, 0.28, -0.85], [sign * 2.45, 0.04, -2.45], [sign * 3.85, -0.16, -4.15]],
    [[0, 0, -0.12], [sign * 0.7, 0.06, -1.15], [sign * 1.45, -0.08, -2.45], [sign * 2.15, -0.2, -3.7]],
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
    placed(rod, BONE, sign * 1.2, 0.32, -0.45, 0.55, 0, sign * 0.55, 1, 2.7, 1),
    placed(rod, BONE, sign * 1.9, 0.04, -1.9, 0.85, 0, sign * 0.42, 1, 4.3, 1),
    placed(rod, BONE, sign * 1.05, -0.04, -1.85, 1.0, 0, sign * 0.35, 1, 3.6, 1),
    placed(rod, BONE, sign * 0.22, 0.12, 0.04, 0.2, 0, sign * 0.85, 0.35, 0.55, 0.35),
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
        color: "#c4472a",
        transparent: true,
        opacity: 0.58,
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
        <group ref={eyes} position={[0, 1.02, 2.78]}>
          {skull && <mesh geometry={skull} material={bodyMat} />}
          {([-1, 1] as const).map((side) => (
            <group key={side} position={[side * 0.16, 0.1, 0.22]}>
              <mesh>
                <sphereGeometry args={[0.042, 10, 8]} />
                <meshStandardMaterial color="#e6b15a" roughness={0.22} metalness={0.18} />
              </mesh>
              <mesh position={[0, 0, 0.02]} scale={[0.45, 0.16, 0.28]}>
                <sphereGeometry args={[0.026, 6, 4]} />
                <meshBasicMaterial color="#0c0604" />
              </mesh>
            </group>
          ))}
          <group ref={jaw} position={[0, -0.1, 0.32]}>
            {jawGeo && (
              <mesh geometry={jawGeo}>
                <meshStandardMaterial vertexColors roughness={0.88} metalness={0.02} />
              </mesh>
            )}
            <mesh position={[0, 0.02, 0.18]}>
              <boxGeometry args={[0.16, 0.03, 0.22]} />
              <meshBasicMaterial color="#14080a" />
            </mesh>
          </group>
        </group>
        <object3D ref={mouthAnchor} position={[0, 0.88, 3.72]} />
        <group ref={left} position={[0.34, 0.28, 1.15]}>
          <mesh geometry={wings[0].bone} material={boneMat} />
          <mesh geometry={wings[0].skin} material={skinMat} renderOrder={2} />
        </group>
        <group ref={right} position={[-0.34, 0.28, 1.15]}>
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

const REPLY_BOWS = 16;
const REPLY_ARROWS = 8;

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
    let bowN = 0;
    let arrowN = 0;
    for (let i = 0; i < n && bowN < REPLY_BOWS; i++) {
      if (!dragonIsArcher(i, n)) continue;
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

const HORSE_SCALE = 1.32;

function buildHorseBody() {
  const coat = new THREE.Color("#6b4228");
  const belly = new THREE.Color("#8d5e3c");
  const dark = new THREE.Color("#24160e");
  const blaze = new THREE.Color("#f4e7d4");
  const stations: Station[] = [
    { x: 0, y: 1.16, z: -1.02, rx: 0.06, ry: 0.05 },
    { x: 0, y: 1.26, z: -0.68, rx: 0.2, ry: 0.17 },
    { x: 0, y: 1.14, z: -0.22, rx: 0.26, ry: 0.21 },
    { x: 0, y: 1.08, z: 0.22, rx: 0.23, ry: 0.25 },
    { x: 0, y: 1.18, z: 0.52, rx: 0.17, ry: 0.18 },
    { x: 0, y: 1.36, z: 0.66, rx: 0.11, ry: 0.1 },
    { x: 0, y: 1.56, z: 0.8, rx: 0.085, ry: 0.078 },
    { x: 0, y: 1.76, z: 0.94, rx: 0.072, ry: 0.068 },
    { x: 0, y: 1.64, z: 1.14, rx: 0.062, ry: 0.078 },
    { x: 0, y: 1.46, z: 1.32, rx: 0.048, ry: 0.05 },
    { x: 0, y: 1.34, z: 1.46, rx: 0.038, ry: 0.032 },
  ];
  const tube = skinTube(stations, 10, coat, belly, 0, 0.15);
  const ear = new THREE.ConeGeometry(0.028, 0.15, 5);
  const mane = new THREE.ConeGeometry(0.03, 0.14, 4);
  const hair = new THREE.ConeGeometry(0.035, 0.48, 5);
  const eye = new THREE.SphereGeometry(0.026, 8, 6);
  const pad = new THREE.BoxGeometry(0.34, 0.05, 0.46);
  const parts: THREE.BufferGeometry[] = [tube];
  (
    [
      [1.3, 0.6],
      [1.48, 0.74],
      [1.66, 0.88],
      [1.82, 0.98],
    ] as const
  ).forEach(([y, z], i) => {
    parts.push(placed(mane, dark, 0, y + 0.06, z, -0.35, 0, 0, 0.65, 0.75 + i * 0.12, 0.45));
  });
  parts.push(placed(ear, dark, -0.04, 1.9, 0.96, -0.4, 0, -0.28));
  parts.push(placed(ear, dark, 0.04, 1.9, 0.96, -0.4, 0, 0.28));
  parts.push(placed(eye, new THREE.Color("#120c08"), -0.062, 1.66, 1.12));
  parts.push(placed(eye, new THREE.Color("#120c08"), 0.062, 1.66, 1.12));
  parts.push(placed(eye, blaze, 0, 1.62, 1.2, 0, 0, 0, 0.28, 1.1, 0.22));
  parts.push(placed(eye, new THREE.Color("#1a100c"), -0.018, 1.36, 1.48, 0, 0, 0, 0.45, 0.35, 0.4));
  parts.push(placed(eye, new THREE.Color("#1a100c"), 0.018, 1.36, 1.48, 0, 0, 0, 0.45, 0.35, 0.4));
  parts.push(placed(hair, dark, 0, 0.92, -0.98, 0.25, 0, 0));
  parts.push(placed(hair, dark, 0.02, 0.72, -0.96, 0.08, 0.15, 0, 0.65, 0.9, 0.55));
  parts.push(placed(pad, new THREE.Color("#3a2416"), 0, 1.38, -0.02));
  const merged = prepMerge(parts);
  ear.dispose();
  mane.dispose();
  hair.dispose();
  eye.dispose();
  pad.dispose();
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
    hit.set(-0.5, 0.22, 0.15).multiplyScalar(1.88).applyEuler(euler);
    hit.x += drake.x;
    hit.y += drake.y;
    hit.z += drake.z;
    if (spear.current) {
      if (t < SPEAR_LOOSE) {
        locked.current = false;
        const wind = Math.max(0, Math.min(1, (t - (SPEAR_LOOSE - 0.45)) / 0.45));
        euler.set(0, ride.yaw, 0);
        from.set(0.46, 1.92, 0.38).multiplyScalar(HORSE_SCALE).applyEuler(euler);
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
      <group ref={horse} scale={HORSE_SCALE}>
        <mesh geometry={horseBody}>
          <meshLambertMaterial vertexColors />
        </mesh>
        {(
          [
            [fl, -0.1, 0.4, 0.82],
            [fr, 0.1, 0.4, 0.82],
            [hl, -0.1, -0.48, 0.9],
            [hr, 0.1, -0.48, 0.9],
          ] as const
        ).map(([ref, x, z, y]) => (
          <group key={`${x}-${z}`} ref={ref} position={[x, y, z]}>
            <mesh position={[0, -0.2, 0]}>
              <cylinderGeometry args={[0.055, 0.07, 0.4, 7]} />
              <meshLambertMaterial color="#6b4228" />
            </mesh>
            <mesh position={[0, -0.52, 0.02]} rotation={[0.12, 0, 0]}>
              <cylinderGeometry args={[0.038, 0.048, 0.36, 6]} />
              <meshLambertMaterial color="#5a3824" />
            </mesh>
            <mesh position={[0, -0.74, 0.05]}>
              <boxGeometry args={[0.07, 0.055, 0.12]} />
              <meshLambertMaterial color="#1a120c" />
            </mesh>
          </group>
        ))}
        <group position={[0, 1.4, -0.04]}>
          <mesh position={[0, 0.08, -0.16]} rotation={[0.18, 0, 0]}>
            <boxGeometry args={[0.5, 0.72, 0.04]} />
            <meshLambertMaterial color="#6e1018" />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <boxGeometry args={[0.5, 0.58, 0.28]} />
            <meshLambertMaterial color="#1d4ed8" />
          </mesh>
          <mesh position={[0, 0.42, 0.13]}>
            <boxGeometry args={[0.28, 0.32, 0.04]} />
            <meshLambertMaterial color="#e2c15a" />
          </mesh>
          <mesh position={[0, 0.62, 0]}>
            <boxGeometry args={[0.46, 0.08, 0.3]} />
            <meshLambertMaterial color="#e2c15a" />
          </mesh>
          <mesh position={[0, 0.78, 0.02]}>
            <boxGeometry args={[0.24, 0.22, 0.22]} />
            <meshLambertMaterial color="#f0e6d4" />
          </mesh>
          <mesh position={[0, 0.98, 0]}>
            <coneGeometry args={[0.16, 0.24, 6]} />
            <meshLambertMaterial color="#e2c15a" />
          </mesh>
          <mesh position={[0, 1.28, -0.04]}>
            <boxGeometry args={[0.05, 0.48, 0.05]} />
            <meshLambertMaterial color="#f7f4ee" />
          </mesh>
          <mesh position={[0.28, 0.42, 0.2]} rotation={[0.85, 0, -0.4]}>
            <boxGeometry args={[0.1, 0.52, 0.1]} />
            <meshLambertMaterial color="#1d4ed8" />
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
  float tailW = smoothstep(-0.8, -10.4, transformed.z);
  float neckW = smoothstep(1.6, 2.6, transformed.z);
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
