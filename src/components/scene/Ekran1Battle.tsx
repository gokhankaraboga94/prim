import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EKRAN1_SECONDS, ekran1MarkReady, ekran1Reset, ekran1T } from "../../ekran1Reel";

/**
 * 12s matrix cyber-eye — deep black + #39FF14.
 * Hook: center pulse 0–0.5s → mechanical eye open → rings → scan takeover → particle flood.
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

const vec3 NEON = vec3(0.222, 1.0, 0.078); // #39FF14

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash21(float n) {
  return fract(sin(n * 78.233) * 43758.5453);
}

float easeOut(float x) {
  x = clamp(x, 0.0, 1.0);
  return 1.0 - pow(1.0 - x, 3.0);
}

float easeInOut(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * (3.0 - 2.0 * x);
}

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdRing(vec2 p, float r, float w) {
  return abs(length(p) - r) - w;
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 uv = vUv;
  // Centered aspect-correct coords (y spans ~[-0.89,0.89] on 9:16)
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(1.0, 1.0 / aspect);
  float t = uT;

  // Phase weights
  float pulsePh = clamp(t / 0.5, 0.0, 1.0);                 // 0–0.5
  float eyeBuild = easeOut(clamp((t - 0.45) / 1.0, 0.0, 1.0)); // 0.5–1.5
  float lidOpen = easeOut(clamp((t - 0.85) / 0.55, 0.0, 1.0));
  float ringsPh = easeOut(clamp((t - 1.45) / 1.5, 0.0, 1.0));  // 1.5–3
  float scanPh = easeInOut(clamp((t - 2.9) / 4.0, 0.0, 1.0));  // 3–7
  float dissolve = easeInOut(clamp((t - 6.8) / 4.5, 0.0, 1.0)); // 7–12
  float eyeFade = 1.0 - easeInOut(clamp((t - 7.0) / 2.2, 0.0, 1.0));

  float spin = scanPh * 1.35 + t * 0.35 * scanPh;

  vec2 pe = p * rot(spin * 0.55);
  // Subtle pupil lock: tiny offset toward center (viewer)
  pe += vec2(0.0, 0.004) * lidOpen;

  float glow = 0.0;
  float core = 0.0;

  // --- 0–0.5: violent center pulse ---
  float beat = 0.5 + 0.5 * sin(t * 42.0);
  float dotR = mix(0.004, 0.055, easeOut(pulsePh)) * (0.75 + 0.45 * beat);
  float dDot = sdCircle(p, dotR);
  float seed = (1.0 - smoothstep(0.0, 0.012, dDot)) * (1.0 - eyeBuild * 0.85);
  seed += exp(-dDot * dDot * 900.0) * 0.55 * (1.0 - eyeBuild);
  // Frame-0 flash
  seed += (1.0 - smoothstep(0.0, 0.12, t)) * 0.9 * (1.0 - smoothstep(0.02, 0.08, length(p)));

  // --- Mechanical digital eye ---
  float eyeR = mix(0.02, 0.22, eyeBuild);
  float irisR = eyeR * 0.62;
  float pupilR = irisR * mix(0.55, 0.28, lidOpen);

  // Eyelid aperture (horizontal slit opens)
  float lidH = mix(0.008, eyeR * 1.15, lidOpen);
  float lidMask = 1.0 - smoothstep(lidH, lidH + 0.01, abs(pe.y));
  lidMask *= smoothstep(eyeR + 0.02, eyeR - 0.01, length(pe.xy / vec2(1.0, mix(3.5, 1.0, lidOpen))));

  float dEye = sdCircle(pe, eyeR);
  float dIris = sdCircle(pe, irisR);
  float dPupil = sdCircle(pe, pupilR);

  // Outer mechanical shell + gear teeth
  float ang = atan(pe.y, pe.x);
  float teeth = 0.5 + 0.5 * sin(ang * 18.0 + spin * 4.0);
  float shell = (1.0 - smoothstep(-0.01, 0.012, dEye)) * eyeBuild;
  shell *= 0.35 + 0.65 * teeth;
  // Iris circuit rings
  float irisBand = (1.0 - smoothstep(0.0, 0.01, abs(dIris + 0.01))) * eyeBuild;
  float irisFill = (1.0 - smoothstep(-0.002, 0.02, dIris)) * (smoothstep(-0.002, 0.02, dPupil)) * eyeBuild;
  // Circuit spokes
  float spokes = pow(0.5 + 0.5 * sin(ang * 12.0 - t * 3.0), 8.0) * irisFill;
  // Pupil
  float pupil = (1.0 - smoothstep(0.0, 0.01, dPupil)) * eyeBuild * lidOpen;
  float pupilGlow = exp(-max(dPupil, 0.0) * 80.0) * eyeBuild * lidOpen;

  // Hex micro-detail on iris
  vec2 hex = pe * 55.0;
  float hx = abs(fract(hex.x) - 0.5);
  float hy = abs(fract(hex.y + floor(hex.x) * 0.5) - 0.5);
  float hexL = (1.0 - smoothstep(0.42, 0.48, max(hx, hy))) * irisFill * 0.45;

  float eyeBody = (shell * 0.55 + irisBand + irisFill * 0.35 + spokes + hexL + pupil + pupilGlow * 1.2) * lidMask * eyeFade;

  // --- Scanning rings from pupil (1.5–3+) ---
  float rings = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float rr = pupilR + 0.04 + fi * 0.055 + ringsPh * (0.15 + fi * 0.12) + fract(t * 0.35 + fi * 0.17) * 0.08 * ringsPh;
    float w = 0.0035 + 0.0015 * sin(t * 8.0 + fi);
    float rd = sdRing(pe, rr, w);
    rings += (1.0 - smoothstep(0.0, 0.004, rd)) * ringsPh * (1.0 - fi * 0.08) * eyeFade;
  }

  // Laser lines / particles around eye
  float lasers = 0.0;
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float a0 = fi * 0.628 + t * (0.6 + fi * 0.05) * ringsPh;
    vec2 dir = vec2(cos(a0), sin(a0));
    float along = dot(p, dir);
    float across = abs(p.x * dir.y - p.y * dir.x);
    float seg = step(eyeR * 0.3, along) * step(along, mix(eyeR, 0.95, ringsPh));
    lasers += (1.0 - smoothstep(0.0015, 0.006, across)) * seg * ringsPh * 0.55 * eyeFade;
  }
  // Tiny particles
  float parts = 0.0;
  for (int i = 0; i < 18; i++) {
    float fi = float(i);
    float a1 = hash21(fi + 1.3) * 6.2832 + t * (0.4 + hash21(fi) * 1.2);
    float rad = mix(0.08, 0.75, hash21(fi + 4.2)) * mix(0.2, 1.0, ringsPh + scanPh * 0.5);
    vec2 qp = vec2(cos(a1), sin(a1)) * rad;
    float d = length(p - qp);
    parts += exp(-d * d * 3500.0) * (ringsPh * 0.7 + scanPh * 0.5) * eyeFade;
  }

  // --- Screen scan lines takeover (3–7) ---
  float scans = 0.0;
  float nLines = mix(8.0, 120.0, scanPh);
  float ly = fract(uv.y * nLines + t * 2.5);
  scans += (1.0 - smoothstep(0.0, 0.08, ly)) * scanPh * 0.55;
  float lx = fract(uv.x * nLines * 0.55 - t * 1.8);
  scans += (1.0 - smoothstep(0.0, 0.1, lx)) * scanPh * 0.25;
  // Radial sweep from center
  float sweep = fract(atan(p.y, p.x) / 6.2832 + t * 0.55);
  scans += (1.0 - smoothstep(0.0, 0.04, sweep)) * scanPh * 0.35 * (1.0 - dissolve * 0.5);

  // Expanding tech field
  float field = smoothstep(0.0, 1.0, scanPh) * exp(-length(p) * mix(2.5, 0.2, scanPh)) * 0.35;

  // --- Dissolve to matrix particles (7–12) ---
  float flood = 0.0;
  float cols = 36.0;
  float col = floor(uv.x * cols);
  float row = floor(uv.y * 64.0);
  float speed = 1.8 + hash(vec2(col, 0.7)) * 4.0;
  float head = fract(hash(vec2(col, 3.1)) + t * speed * 0.25);
  float trail = fract(head - uv.y);
  float rain = (1.0 - smoothstep(0.0, 0.45, trail)) * step(0.35, hash(vec2(col, row + floor(t * 10.0))));
  flood += rain * dissolve;

  // Burst particles from eye position
  float burst = 0.0;
  for (int i = 0; i < 24; i++) {
    float fi = float(i);
    float a2 = hash21(fi + 9.1) * 6.2832;
    float life = easeOut(clamp((t - 7.0 - hash21(fi) * 1.2) / 3.5, 0.0, 1.0));
    float rad2 = life * (0.2 + hash21(fi + 2.2) * 1.1);
    vec2 bp = vec2(cos(a2), sin(a2)) * rad2;
    float d2 = length(p - bp);
    burst += exp(-d2 * d2 * mix(2000.0, 200.0, life)) * dissolve * (1.0 - life * 0.3);
  }
  flood += burst;

  // Final full-screen matrix density
  float cell = step(0.4, hash(vec2(floor(uv.x * 28.0), floor(uv.y * 50.0)) + floor(t * 8.0)));
  flood = max(flood, cell * easeInOut(clamp((t - 9.5) / 2.2, 0.0, 1.0)));

  glow = seed + eyeBody + rings + lasers + parts + scans + field + flood;
  glow = clamp(glow, 0.0, 1.75);

  // High-contrast neon on pure black — no gray
  float pulse = 0.88 + 0.12 * sin(t * 14.0 + length(p) * 10.0);
  vec3 colrgb = NEON * glow * pulse;
  // Hot core near pupil / seed
  colrgb += NEON * (pupilGlow * 0.8 * eyeFade + seed * 0.5);
  // Soft bloom without going white/gray
  colrgb = min(colrgb, NEON * 1.35);

  // Fine scan CRT only on lit pixels
  float crt = 0.93 + 0.07 * sin(uv.y * uRes.y * 1.15);
  colrgb *= mix(1.0, crt, step(0.02, glow));

  gl_FragColor = vec4(colrgb, 1.0);
}
`;

export function Ekran1Battle() {
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
    ekran1Reset();
    ekran1MarkReady();
    return () => {
      ekran1Reset();
      mat.dispose();
    };
  }, [mat]);

  useFrame(() => {
    mat.uniforms.uT.value = ekran1T();
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

export function Ekran1Cam() {
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
