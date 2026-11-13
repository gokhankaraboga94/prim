import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ekran4MarkReady, ekran4Reset, ekran4T } from "../../ekran4Reel";

/**
 * 12s reality-break — center glitch → pixel crack → edge shatter → 3D fragments → sync flood.
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

float hash21(float n) {
  return fract(sin(n * 78.233) * 43758.5453);
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

float easeOut(float x) {
  x = clamp(x, 0.0, 1.0);
  return 1.0 - pow(1.0 - x, 3.0);
}

float easeInOut(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * (3.0 - 2.0 * x);
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

void main() {
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(1.0, 1.0 / aspect);
  float t = uT;
  float dist = length(p);

  float flash = 1.0 - smoothstep(0.0, 0.1, t);
  float glitchPh = easeOut(clamp(t / 0.5, 0.0, 1.0));              // 0–0.5
  float crackPh = easeOut(clamp((t - 0.4) / 1.5, 0.0, 1.0));         // 0.5–2
  float branchPh = easeInOut(clamp((t - 1.8) / 2.2, 0.0, 1.0));      // 2–4
  float flyPh = easeInOut(clamp((t - 3.8) / 3.2, 0.0, 1.0));         // 4–7
  float chaosPh = easeInOut(clamp((t - 6.8) / 3.2, 0.0, 1.0));       // 7–10
  float mergePh = easeInOut(clamp((t - 9.8) / 2.2, 0.0, 1.0));       // 10–12

  float g = 0.0;

  // --- 0–0.5: center digital malfunction ---
  float jitter = (hash(vec2(floor(t * 40.0), 1.2)) - 0.5) * 0.02 * glitchPh;
  vec2 pc = p + vec2(jitter, -jitter * 0.7);
  float coreR = mix(0.006, 0.04, glitchPh) * (0.7 + 0.5 * sin(t * 50.0));
  float mal = exp(-dot(pc, pc) / (coreR * coreR * 2.5));
  // Pixel block noise in center
  vec2 cell = floor(uv * mix(80.0, 40.0, glitchPh));
  float pix = step(0.55, hash(cell + floor(t * 24.0))) * step(dist, mix(0.05, 0.12, glitchPh));
  float seed = (mal + pix * 0.8) * (1.0 - crackPh * 0.5);
  seed += flash * mal * 1.2;

  // --- Crack: radial glass/pixel fractures ---
  float cracks = 0.0;
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float a0 = fi * 0.449 + hash21(fi) * 0.35;
    vec2 dir = vec2(cos(a0), sin(a0));
    float along = dot(p, dir);
    float across = abs(p.x * dir.y - p.y * dir.x);
    // Jagged width via noise
    float jag = 0.004 + 0.006 * noise(vec2(along * 20.0, fi));
    float len = mix(0.05, 0.55, crackPh) * mix(1.0, 1.8, branchPh);
    // Branch secondary forks
    float fork = 0.0;
    if (along > len * 0.35) {
      float a1 = a0 + (hash21(fi + 3.0) - 0.5) * 1.1 * branchPh;
      vec2 d2 = vec2(cos(a1), sin(a1));
      float al2 = dot(p - dir * len * 0.35, d2);
      float ac2 = abs((p - dir * len * 0.35).x * d2.y - (p - dir * len * 0.35).y * d2.x);
      fork = (1.0 - smoothstep(0.0, jag * 1.2, ac2)) * step(0.0, al2) * step(al2, len * 0.7) * branchPh;
    }
    float line = (1.0 - smoothstep(0.0, jag, across)) * step(0.0, along) * step(along, len);
    // Pixel glass grit along crack
    float grit = step(0.4, hash(vec2(floor(along * 60.0), fi + floor(t * 10.0)))) * line;
    cracks += (line * 0.9 + grit * 0.55 + fork) * crackPh;
  }

  // Shatter field: black “breaking” as cracks reach edges
  float edgeReach = smoothstep(0.35, 0.95, branchPh);
  float shatterMask = cracks * edgeReach;

  // --- Flying 3D fragments toward viewer (4–7+) ---
  float frags = 0.0;
  for (int i = 0; i < 36; i++) {
    float fi = float(i);
    float seedA = hash21(fi + 1.1) * 6.2832;
    float seedR = 0.05 + hash21(fi + 2.2) * 0.55;
    float birth = 3.9 + hash21(fi + 0.4) * 1.8;
    float life = easeOut(clamp((t - birth) / 3.5, 0.0, 1.0));
    // Fly toward camera: expand from seed radius
    float rad = seedR + life * (0.35 + hash21(fi + 5.0) * 1.1) * (0.6 + flyPh);
    vec2 center = vec2(cos(seedA), sin(seedA)) * rad * 0.15;
    center *= rot(life * (2.0 + hash21(fi) * 4.0));
    // Perspective scale: nearer = bigger, brighter
    float z = mix(1.8, 0.15, life);
    vec2 fp = (p - center) / z;
    fp *= rot(life * 6.0 + fi);
    // Quad shard
    float sx = 0.02 + hash21(fi + 7.0) * 0.04;
    float sy = 0.015 + hash21(fi + 8.0) * 0.035;
    float box = max(abs(fp.x) / sx, abs(fp.y) / sy);
    float shard = (1.0 - smoothstep(0.85, 1.05, box)) * step(0.01, life) * (1.0 - mergePh * 0.85);
    // Edge glow of shard
    float edge = (1.0 - smoothstep(0.0, 0.12, abs(box - 0.95))) * shard;
    frags += (shard * 0.55 + edge) * (flyPh * 0.5 + chaosPh * 0.5 + step(4.0, t) * 0.3) / z;
  }

  // --- Chaos: glitch waves + laser lines (7–10) ---
  float chaos = 0.0;
  // Horizontal glitch bands
  float bandY = floor(uv.y * mix(20.0, 60.0, chaosPh) + t * 8.0);
  float band = step(0.62, hash(vec2(bandY, floor(t * 15.0)))) * chaosPh;
  float shift = (hash(vec2(bandY, 3.3)) - 0.5) * 0.08 * chaosPh;
  chaos += band * step(abs(uv.x - 0.5 - shift), 0.5) * 0.25;
  // Laser streaks
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float a = fi * 0.785 + t * (0.8 + fi * 0.1) * chaosPh;
    vec2 d = vec2(cos(a), sin(a));
    float across = abs(p.x * d.y - p.y * d.x);
    chaos += (1.0 - smoothstep(0.001, 0.008, across)) * chaosPh * 0.4;
  }
  // Radial shockwaves
  float shock = abs(fract(dist * 3.0 - t * 2.2) - 0.5);
  chaos += (1.0 - smoothstep(0.0, 0.04, shock)) * chaosPh * 0.35;

  // --- Sync merge to solid green (10–12) ---
  float merge = mergePh * mergePh;
  // Fragments snap inward then flood
  float sync = exp(-dist * mix(2.0, 0.2, merge)) * merge;
  float fill = smoothstep(0.0, 1.0, merge) * (0.55 + 0.45 * noise(uv * 30.0 + t * 2.0));
  // Final solid
  float solid = easeInOut(clamp((t - 10.5) / 1.4, 0.0, 1.0));

  g = seed + cracks + shatterMask * 0.35 + frags + chaos + sync + fill * 0.7;
  g = mix(g, 1.0, solid * 0.95);
  g = clamp(g, 0.0, 1.9);

  float pulse = 0.88 + 0.12 * sin(t * 20.0 + dist * 15.0);
  vec3 col = NEON * g * pulse;
  col += NEON * seed * 0.5;
  col = min(col, NEON * 1.4);

  float crt = 0.93 + 0.07 * sin(uv.y * uRes.y * 1.2 + t * 10.0);
  col *= mix(1.0, crt, step(0.02, g));

  gl_FragColor = vec4(col, 1.0);
}
`;

export function Ekran4Battle() {
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
    ekran4Reset();
    ekran4MarkReady();
    return () => {
      ekran4Reset();
      mat.dispose();
    };
  }, [mat]);

  useFrame(() => {
    mat.uniforms.uT.value = ekran4T();
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

export function Ekran4Cam() {
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
