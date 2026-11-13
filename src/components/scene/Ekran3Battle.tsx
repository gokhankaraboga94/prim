import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ekran3MarkReady, ekran3Reset, ekran3T } from "../../ekran3Reel";

/**
 * 12s living neon-green liquid invasion — pure black + #39FF14.
 * Hook: bottom tendril → branching crawl → vein network → organism pulse → full flood.
 */
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uT;
uniform vec2 uRes;

const vec3 NEON = vec3(0.222, 1.0, 0.078);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

float easeOut(float x) {
  x = clamp(x, 0.0, 1.0);
  return 1.0 - pow(1.0 - x, 3.0);
}

float easeInOut(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * (3.0 - 2.0 * x);
}

// Soft distance to a wavy polyline segment rising from bottom
float tendril(vec2 uv, float seed, float climb, float thick) {
  // Parametric X wander along Y
  float y0 = 0.0;
  float y1 = climb;
  float along = clamp((uv.y - y0) / max(y1 - y0, 0.001), 0.0, 1.0);
  float wander = 0.0;
  wander += 0.12 * sin(uv.y * 9.0 + seed * 6.0 + uT * 1.6);
  wander += 0.07 * sin(uv.y * 17.0 - seed * 4.0 + uT * 2.3);
  wander += 0.04 * (fbm(vec2(uv.y * 4.0 + seed, uT * 0.4 + seed)) - 0.5);
  float cx = 0.5 + (seed - 0.5) * 0.85 + wander * along;
  // Branch offsets
  float branch = step(0.35, along) * 0.08 * sin(uv.y * 14.0 + seed * 10.0) * easeOut(clamp((uT - 0.5) / 1.5, 0.0, 1.0));
  cx += branch * sin(seed * 20.0);
  float d = abs(uv.x - cx);
  // Taper tip
  float tip = smoothstep(climb, climb - 0.08, uv.y);
  float w = thick * (0.55 + 0.45 * tip) * step(uv.y, climb + 0.02) * step(0.0, uv.y + 0.01);
  return (1.0 - smoothstep(0.0, w, d)) * tip;
}

void main() {
  vec2 uv = vUv;
  float t = uT;
  float aspect = uRes.x / max(uRes.y, 1.0);

  float flash = 1.0 - smoothstep(0.0, 0.1, t);
  float risePh = easeOut(clamp(t / 0.5, 0.0, 1.0));                 // 0–0.5
  float branchPh = easeOut(clamp((t - 0.45) / 1.5, 0.0, 1.0));        // 0.5–2
  float netPh = easeInOut(clamp((t - 1.8) / 2.2, 0.0, 1.0));          // 2–4
  float pulsePh = easeInOut(clamp((t - 3.8) / 4.0, 0.0, 1.0));        // 4–8
  float floodPh = easeInOut(clamp((t - 7.8) / 4.0, 0.0, 1.0));        // 8–12

  float g = 0.0;

  // --- Primary rising stem (hook) ---
  float climb0 = mix(0.08, 1.05, risePh) * mix(1.0, 1.0, branchPh);
  float stem = tendril(uv, 0.5, climb0, mix(0.01, 0.018, risePh));
  stem += flash * (1.0 - smoothstep(0.0, 0.03, abs(uv.x - 0.5))) * step(uv.y, 0.12);

  // --- Branching tendrils ---
  float branches = 0.0;
  for (int i = 0; i < 11; i++) {
    float fi = float(i);
    float seed = hash(vec2(fi, 2.7));
    float delay = fi * 0.07;
    float local = easeOut(clamp((t - 0.5 - delay) / 1.4, 0.0, 1.0));
    float climb = mix(0.15, 1.15, local) * branchPh;
    float thick = mix(0.006, 0.014, local) * (0.7 + 0.3 * sin(t * 3.0 + fi));
    branches += tendril(uv, seed, climb, thick) * local;
  }

  // Side creepers from bottom corners
  float side = 0.0;
  side += tendril(uv + vec2(-0.08, 0.0), 0.18, mix(0.1, 0.95, branchPh), 0.01) * branchPh;
  side += tendril(uv + vec2(0.08, 0.0), 0.82, mix(0.1, 0.95, branchPh), 0.01) * branchPh;

  // --- Vein network: domain-warped filaments connecting ---
  float veins = 0.0;
  vec2 wp = uv * vec2(3.2, 4.5);
  wp += 0.35 * vec2(fbm(wp + t * 0.15), fbm(wp + vec2(3.1, t * 0.12)));
  float n1 = fbm(wp * 1.4 + t * 0.2);
  float n2 = fbm(wp * 2.2 - t * 0.18 + 8.0);
  // Ridge lines where noise crosses mid
  float ridge = 1.0 - abs(n1 * 2.0 - 1.0);
  ridge = pow(smoothstep(0.55, 0.92, ridge), 2.2);
  float ridge2 = 1.0 - abs(n2 * 2.0 - 1.0);
  ridge2 = pow(smoothstep(0.6, 0.95, ridge2), 2.5);
  // Growth mask from bottom + from tendril presence
  float growMask = smoothstep(0.0, 1.0, uv.y * 0.3 + branchPh * 0.9 + stem * 0.5);
  veins = (ridge * 0.85 + ridge2 * 0.65) * netPh * growMask;

  // Connection blobs at junctions
  float blobs = smoothstep(0.72, 0.9, n1 * n2) * netPh * growMask * 0.55;

  // --- Organism pulse (4–8) ---
  float breath = 0.5 + 0.5 * sin(t * 2.4);
  float pulse = pulsePh * (0.75 + 0.35 * breath);
  // Flowing liquid waves through network
  float flow = sin((uv.x * 8.0 + uv.y * 12.0) - t * 5.5 + n1 * 6.0);
  float wave = smoothstep(0.35, 0.95, flow) * pulse * (veins + stem + branches) * 1.1;
  // Expand / contract thickness feel
  float body = (stem + branches * 0.9 + side * 0.7 + veins + blobs) * (1.0 + pulsePh * 0.35 * breath);

  // Metallic sheen along edges
  float sheen = pow(1.0 - abs(flow), 6.0) * pulsePh * body * 0.45;

  // --- Flood fill (8–12) ---
  // Soft organic front expanding from network
  float field = fbm(uv * 3.5 + vec2(t * 0.1, -t * 0.08));
  float coverage = mix(0.15, 1.35, floodPh);
  float occupied = body * 0.5 + field * 0.55 + (1.0 - uv.y) * 0.2;
  float flood = smoothstep(coverage - 0.25, coverage, occupied + floodPh * 0.5);
  // Flowing surface detail on flood
  float surface = 0.55 + 0.45 * sin(fbm(uv * 8.0 - t * 0.6) * 12.0 + t * 3.0);
  flood *= mix(1.0, surface, floodPh);

  g = body + wave + sheen + flood * floodPh;
  // Early stem dominates first half-second
  g = max(g, stem * (1.0 + flash));
  g = clamp(g, 0.0, 1.85);

  float sparkle = 0.92 + 0.08 * sin(t * 18.0 + uv.y * 30.0);
  vec3 col = NEON * g * sparkle;
  // Hot liquid core
  col += NEON * wave * 0.35;
  col = min(col, NEON * 1.4);

  float crt = 0.94 + 0.06 * sin(uv.y * uRes.y * 1.05);
  col *= mix(1.0, crt, step(0.02, g));

  gl_FragColor = vec4(col, 1.0);
}
`;

export function Ekran3Battle() {
  const size = useThree((s) => s.size);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uT: { value: 0 },
          uRes: { value: new THREE.Vector2(1080, 1920) },
        },
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    ekran3Reset();
    ekran3MarkReady();
    return () => {
      ekran3Reset();
      mat.dispose();
    };
  }, [mat]);

  useFrame(() => {
    mat.uniforms.uT.value = ekran3T();
    mat.uniforms.uRes.value.set(size.width, size.height);
  });

  return (
    <group>
      <color attach="background" args={["#000000"]} />
      <mesh frustumCulled={false} renderOrder={50} material={mat}>
        <planeGeometry args={[2, 2]} />
      </mesh>
    </group>
  );
}

export function Ekran3Cam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    if (camera.fov !== 40) {
      camera.fov = 40;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
