import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { REEL_HOLD } from "../../recordCanvas";
import { FIRE_R, breathSlots, dragonAt, dragonBreathIndex, dragonBreaths } from "../../dragonReel";

const DORSAL = new THREE.Color("#3c4632");
const BELLY = new THREE.Color("#c2a06a");
const HORN = new THREE.Color("#d7c4a2");
const BONE = new THREE.Color("#4a4034");

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
      pos.push(
        f.s.x + f.right.x * ca * f.s.rx + f.up.x * (sa * f.s.ry + ridge),
        f.s.y + f.right.y * ca * f.s.rx + f.up.y * (sa * f.s.ry + ridge),
        f.s.z + f.right.z * ca * f.s.rx + f.up.z * (sa * f.s.ry + ridge)
      );
      const c = DORSAL.clone().lerp(BELLY, Math.max(0, -sa) * 0.9);
      if (sa > 0.72) c.multiplyScalar(0.62);
      if (i % 2 === 0) c.multiplyScalar(0.9);
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
    { x: 0, y: 0.22, z: -5.15, rx: 0.035, ry: 0.028 },
    { x: 0, y: 0.16, z: -4.35, rx: 0.09, ry: 0.07 },
    { x: 0, y: 0.1, z: -3.5, rx: 0.15, ry: 0.12 },
    { x: 0, y: 0.05, z: -2.65, rx: 0.24, ry: 0.18 },
    { x: 0, y: 0.02, z: -1.8, rx: 0.36, ry: 0.26 },
    { x: 0, y: 0, z: -0.95, rx: 0.5, ry: 0.34 },
    { x: 0, y: -0.02, z: -0.1, rx: 0.62, ry: 0.4 },
    { x: 0, y: 0.04, z: 0.65, rx: 0.54, ry: 0.42 },
    { x: 0, y: 0.2, z: 1.25, rx: 0.4, ry: 0.36 },
    { x: 0, y: 0.46, z: 1.75, rx: 0.26, ry: 0.24 },
    { x: 0, y: 0.72, z: 2.2, rx: 0.22, ry: 0.2 },
    { x: 0, y: 0.9, z: 2.58, rx: 0.3, ry: 0.24 },
    { x: 0, y: 0.92, z: 2.95, rx: 0.26, ry: 0.18 },
    { x: 0, y: 0.8, z: 3.32, rx: 0.14, ry: 0.1 },
    { x: 0, y: 0.72, z: 3.62, rx: 0.045, ry: 0.035 },
  ];
  const tube = skinTube(stations, 18);
  const cone = new THREE.ConeGeometry(0.08, 0.42, 5);
  const sphere = new THREE.SphereGeometry(0.5, 10, 8);
  const extras: THREE.BufferGeometry[] = [tube];
  const spine = [-3.4, -2.6, -1.8, -1.05, -0.3, 0.4, 1.05, 1.55, 2.05];
  spine.forEach((z, i) => {
    const h = 0.28 + (i % 3) * 0.06;
    extras.push(placed(cone, new THREE.Color("#241e16"), 0, 0.55 - Math.abs(z) * 0.04, z, -0.35, 0, 0, 0.7, h / 0.42, 0.55));
  });
  extras.push(placed(cone, HORN, -0.16, 1.18, 2.55, 0.95, 0, 0.35, 1.1, 1.7, 1.1));
  extras.push(placed(cone, HORN, 0.16, 1.18, 2.55, 0.95, 0, -0.35, 1.1, 1.7, 1.1));
  extras.push(placed(cone, new THREE.Color("#6a583c"), -0.28, 0.95, 2.72, 0.7, 0, 0.8, 0.55, 0.8, 0.55));
  extras.push(placed(cone, new THREE.Color("#6a583c"), 0.28, 0.95, 2.72, 0.7, 0, -0.8, 0.55, 0.8, 0.55));
  extras.push(placed(sphere, new THREE.Color("#1a120e"), -0.07, 0.78, 3.42, 0, 0, 0, 0.08, 0.06, 0.08));
  extras.push(placed(sphere, new THREE.Color("#1a120e"), 0.07, 0.78, 3.42, 0, 0, 0, 0.08, 0.06, 0.08));
  const tooth = new THREE.ConeGeometry(0.025, 0.11, 4);
  for (let i = 0; i < 7; i++) {
    const z = 2.85 + i * 0.09;
    const x = 0.045 + (i % 2) * 0.03;
    extras.push(placed(tooth, new THREE.Color("#f3ead8"), -x, 0.7, z, Math.PI, 0, 0));
    extras.push(placed(tooth, new THREE.Color("#f3ead8"), x, 0.7, z, Math.PI, 0, 0));
  }
  const leg = new THREE.CylinderGeometry(0.07, 0.09, 0.55, 6);
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
  sphere.dispose();
  tooth.dispose();
  leg.dispose();
  claw.dispose();
  if (merged) extras.forEach((g) => g.dispose());
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

function wingGeo(sign: number) {
  const fingers = [
    [[0, 0.02, 0.05], [sign * 1.05, 0.42, 1.25], [sign * 2.15, 0.22, 2.05], [sign * 3.05, -0.05, 2.45]],
    [[0, 0.02, 0.05], [sign * 1.7, 0.72, 0.45], [sign * 3.6, 0.48, 0.05], [sign * 5.6, 0.05, -0.7]],
    [[0, 0.02, 0.05], [sign * 1.55, 0.42, -0.35], [sign * 3.35, 0.12, -1.15], [sign * 5.15, -0.22, -2.15]],
    [[0, 0.02, 0.05], [sign * 1.05, 0.12, -0.75], [sign * 2.15, -0.12, -1.55], [sign * 3.05, -0.32, -2.25]],
  ];
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const leather = new THREE.Color("#5a3028");
  const edge = new THREE.Color("#8a4636");
  const push = (p: number[], along: number) => {
    const c = leather.clone().lerp(edge, along);
    pos.push(p[0], p[1], p[2]);
    col.push(c.r, c.g, c.b);
    return pos.length / 3 - 1;
  };
  for (let f = 0; f < fingers.length - 1; f++) {
    for (let i = 0; i < 3; i++) {
      const along = i / 3;
      const a = push(fingers[f][i], along);
      const b = push(fingers[f][i + 1], (i + 1) / 3);
      const c = push(fingers[f + 1][i], along);
      const d = push(fingers[f + 1][i + 1], (i + 1) / 3);
      if (sign > 0) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const membrane = new THREE.BufferGeometry();
  membrane.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  membrane.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  membrane.setIndex(idx);
  membrane.computeVertexNormals();
  const bone = new THREE.CylinderGeometry(0.035, 0.055, 1, 5);
  const spars = [
    placed(bone, BONE, sign * 1.7, 0.28, 0.95, 0.15, 0, sign * 0.55, 1, 3.4, 1),
    placed(bone, BONE, sign * 2.5, 0.22, -0.15, 0.35, 0, sign * 0.72, 1, 4.2, 1),
    placed(bone, BONE, sign * 2.15, 0.02, -1.05, 0.7, 0, sign * 0.62, 1, 3.6, 1),
    placed(bone, new THREE.Color("#3a3228"), sign * 0.7, 0.18, 0.15, 0.2, 0, sign * 1.05, 1.4, 1.6, 1.4),
  ];
  bone.dispose();
  const parts = [membrane, ...spars];
  const merged = prepMerge(parts);
  if (merged) parts.forEach((g) => g.dispose());
  return merged ?? new THREE.BufferGeometry();
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
    float t = uTime * 3.1 + uSeed;
    float n = noise(vec2(uv.x * 3.5 + uSeed, along * 2.4 - t));
    float n2 = noise(vec2(uv.x * 8.0 - t * 0.4, along * 7.0 - t * 1.8));
    float n3 = noise(vec2(uv.x * 16.0, along * 12.0 - t * 2.6));
    float x = uv.x - 0.5;
    float pinch = mix(0.46, 0.07, pow(along, 0.8));
    pinch += (n - 0.5) * 0.22 * (1.0 - along * 0.65);
    float edge = smoothstep(pinch, pinch * 0.28, abs(x));
    float tongues = smoothstep(0.42, 0.92, n2) * (1.0 - along);
    float body = edge * smoothstep(0.0, 0.05, along) * (1.0 - smoothstep(0.62, 0.98, along + (n3 - 0.5) * 0.12));
    body = max(body, tongues * edge * 0.65);
    float core = smoothstep(pinch, 0.0, abs(x)) * (1.0 - smoothstep(0.0, 0.72, along));
    vec3 col = mix(vec3(1.0, 0.42, 0.05), vec3(0.55, 0.08, 0.015), smoothstep(0.15, 0.9, along));
    col = mix(col, vec3(1.0, 0.93, 0.72), clamp(core * 1.35, 0.0, 1.0));
    col = mix(col, vec3(1.0, 0.72, 0.2), n * 0.35 * (1.0 - uv.y));
    float alpha = body * uStrength * (0.45 + 0.55 * n2);
    if (alpha < 0.015) discard;
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

function GroundFire({ ax, az, t0, dur, armed }: { ax: number; az: number; t0: number; dur: number; armed: boolean }) {
  const scorch = useRef<THREE.MeshBasicMaterial>(null);
  const mat = useMemo(() => makeFlameMaterial(ax * 0.17 + az), [ax, az]);
  const tongues = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        x: Math.sin(i * 1.7) * (0.28 + (i % 3) * 0.22),
        z: Math.cos(i * 1.3) * (0.24 + (i % 4) * 0.16),
        yaw: i * 0.9,
        h: 0.7 + (i % 3) * 0.45,
        w: 0.35 + (i % 2) * 0.2,
      })),
    []
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
        <circleGeometry args={[FIRE_R, 22]} />
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

export function Dragon({ soldiers }: { soldiers: number }) {
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
  const timeU = useRef<THREE.IUniform | null>(null);
  const body = useMemo(() => buildBody(), []);
  const jawGeo = useMemo(() => buildJaw(), []);
  const wings = useMemo(() => [wingGeo(1), wingGeo(-1)] as const, []);
  const emberDummy = useMemo(() => new THREE.Object3D(), []);
  const flameMat = useMemo(() => makeFlameMaterial(1.7, 1), []);
  const mouthPos = useMemo(() => new THREE.Vector3(), []);
  const aimPos = useMemo(() => new THREE.Vector3(), []);
  const aimDir = useMemo(() => new THREE.Vector3(), []);
  const aimUp = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const slots = breathSlots(Math.max(1, soldiers));
  const bodyMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.14 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float tailW = smoothstep(-1.2, -5.1, transformed.z);
        float neckW = smoothstep(1.8, 3.4, transformed.z);
        transformed.x += sin(uTime * 2.5 + transformed.z * 1.2) * tailW * 0.62;
        transformed.y += cos(uTime * 1.9 + transformed.z * 0.7) * tailW * 0.18;
        transformed.x += sin(uTime * 1.25) * neckW * 0.07;
        transformed.y += sin(uTime * 1.6 + 0.4) * neckW * 0.05;`
      );
      timeU.current = shader.uniforms.uTime;
    };
    return m;
  }, []);

  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const p = dragonAt(t);
    const idx = dragonBreathIndex(t);
    const breath = idx >= 0 && idx < slots ? p.breath : 0;
    if (timeU.current) timeU.current.value = t;
    flameMat.uniforms.uTime.value = t;
    flameMat.uniforms.uStrength.value = breath;
    if (root.current) {
      root.current.position.set(p.x, p.y + Math.sin(t * 2.1) * 0.22 * (1 - breath), p.z);
      root.current.rotation.set(p.pitch, p.yaw, p.roll + Math.sin(t * 1.4) * 0.04 * (1 - breath));
      root.current.updateMatrixWorld(true);
    }
    const gliding = breath > 0.25;
    const phase = t * (gliding ? 1.8 : 5.2);
    const wave = Math.sin(phase);
    const flap = wave < 0 ? wave * 1.15 : wave * 0.72;
    const amp = gliding ? 0.14 : 0.42;
    if (left.current) {
      left.current.rotation.z = 0.62 + flap * amp;
      left.current.rotation.x = -0.18 + flap * 0.08;
    }
    if (right.current) {
      right.current.rotation.z = -0.62 - flap * amp;
      right.current.rotation.x = -0.18 + flap * 0.08;
    }
    const neck = Math.sin(t * 1.25) * 0.06;
    if (jaw.current) {
      jaw.current.rotation.x = -0.22 - breath * 0.85;
      jaw.current.position.x = neck;
      jaw.current.position.y = 0.66 + Math.sin(t * 1.6) * 0.04;
    }
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
      const width = FIRE_R * 2.2;
      flame.current.scale.set(width, dist, width);
    }
    if (mouth.current) mouth.current.intensity = breath * 24;
    if (ground.current) {
      ground.current.intensity = breath * 28;
      ground.current.position.set(p.aimX, 1.6, p.aimZ);
    }
    const mesh = embers.current;
    if (mesh) {
      for (let i = 0; i < 64; i++) {
        const speed = 1.35 + (i % 7) * 0.16;
        const u = (t * speed + i * 0.137) % 1;
        if (breath < 0.04) emberDummy.scale.setScalar(0);
        else {
          const spread = (((i * 17) % 11) - 5) * (0.012 + u * 0.05);
          const side = Math.sin(t * 9 + i) * 0.03 * u;
          emberDummy.position.set(spread, 0.04 + u * 0.92, side);
          emberDummy.rotation.set(u * 2, 0, 0);
          const w = (1 - u * 0.35) * (0.05 + (i % 5) * 0.012) * (0.35 + breath);
          emberDummy.scale.set(w, w * 0.12, w);
        }
        emberDummy.updateMatrix();
        mesh.setMatrixAt(i, emberDummy.matrix);
      }
      if (!mesh.userData.painted) {
        for (let i = 0; i < 64; i++) {
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
      for (let i = 0; i < 18; i++) {
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
      <group ref={root} scale={1.92}>
        {body && (
          <mesh geometry={body} material={bodyMat} />
        )}
        <group ref={eyes}>
          <mesh position={[0.13, 1.02, 2.78]}>
            <sphereGeometry args={[0.055, 8, 6]} />
            <meshBasicMaterial color="#e39a18" />
          </mesh>
          <mesh position={[-0.13, 1.02, 2.78]}>
            <sphereGeometry args={[0.055, 8, 6]} />
            <meshBasicMaterial color="#e39a18" />
          </mesh>
          <mesh position={[0.13, 1.02, 2.8]} scale={[0.35, 1, 0.4]}>
            <sphereGeometry args={[0.028, 6, 4]} />
            <meshBasicMaterial color="#140c08" />
          </mesh>
          <mesh position={[-0.13, 1.02, 2.8]} scale={[0.35, 1, 0.4]}>
            <sphereGeometry args={[0.028, 6, 4]} />
            <meshBasicMaterial color="#140c08" />
          </mesh>
        </group>
        <object3D ref={mouthAnchor} position={[0, 0.74, 3.5]} />
        <group ref={jaw} position={[0, 0.66, 2.62]}>
          {jawGeo && (
            <mesh geometry={jawGeo}>
              <meshStandardMaterial vertexColors roughness={0.62} metalness={0.06} />
            </mesh>
          )}
          <mesh position={[0, 0.02, 0.2]}>
            <boxGeometry args={[0.22, 0.08, 0.45]} />
            <meshBasicMaterial color="#14080a" />
          </mesh>
        </group>
        <group ref={left} position={[0.42, 0.38, 0.85]}>
          {wings[0] && (
            <mesh geometry={wings[0]}>
              <meshStandardMaterial vertexColors roughness={0.78} metalness={0.02} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
        <group ref={right} position={[-0.42, 0.38, 0.85]}>
          {wings[1] && (
            <mesh geometry={wings[1]}>
              <meshStandardMaterial vertexColors roughness={0.78} metalness={0.02} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      </group>
      <group ref={flame}>
        {[0, Math.PI / 3, -Math.PI / 3].map((spin) => (
          <mesh key={spin} material={flameMat} position={[0, 0.5, 0]} rotation={[0, spin, 0]}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        ))}
        <mesh material={flameMat} position={[0, 0.42, 0]} rotation={[0, 0.4, 0]}>
          <planeGeometry args={[0.42, 0.7]} />
        </mesh>
        <instancedMesh ref={embers} args={[undefined, undefined, 64]}>
          <sphereGeometry args={[0.16, 5, 4]} />
          <meshBasicMaterial color="#ffb020" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
        </instancedMesh>
        <instancedMesh ref={smoke} args={[undefined, undefined, 18]}>
          <sphereGeometry args={[0.45, 6, 5]} />
          <meshBasicMaterial color="#2a241e" transparent opacity={0.22} depthWrite={false} />
        </instancedMesh>
        <pointLight ref={mouth} color="#ff8a32" intensity={0} distance={18} decay={2} />
      </group>
      <pointLight ref={ground} color="#ff5a12" intensity={0} distance={12} decay={2} />
      {dragonBreaths().map((b, i) => (
        <GroundFire key={i} ax={b.ax} az={b.az} t0={b.t0} dur={b.dur} armed={i < slots} />
      ))}
    </group>
  );
}
