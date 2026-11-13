import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ekran2MarkReady, ekran2Reset, ekran2T } from "../../ekran2Reel";

/**
 * 12s infinite nested green tunnel — black void + #39FF14 edges.
 * Hook: center square flash → nested expand → dive → twist → concentric burst.
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

// Soft square ring (frame) — max-norm distance
float squareFrame(vec2 p, float r, float w) {
  float d = max(abs(p.x), abs(p.y));
  return 1.0 - smoothstep(0.0, w, abs(d - r));
}

float squareFill(vec2 p, float r) {
  float d = max(abs(p.x), abs(p.y));
  return 1.0 - smoothstep(r, r + 0.004, d);
}

void main() {
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(1.0, 1.0 / aspect);
  float t = uT;

  // Phases
  float flash = 1.0 - smoothstep(0.0, 0.12, t);                 // first frame pop
  float seedPh = easeOut(clamp(t / 0.5, 0.0, 1.0));              // 0–0.5
  float nestPh = easeOut(clamp((t - 0.45) / 1.5, 0.0, 1.0));     // 0.5–2
  float divePh = easeInOut(clamp((t - 1.8) / 3.2, 0.0, 1.0));    // 2–5
  float twistPh = easeInOut(clamp((t - 4.8) / 4.0, 0.0, 1.0));   // 5–9
  float burstPh = easeInOut(clamp((t - 8.8) / 3.0, 0.0, 1.0));   // 9–12

  // Camera dive: zoom into nested space
  float zoom = mix(1.0, 18.0, easeOut(divePh));
  zoom *= mix(1.0, 2.4, twistPh);
  float twist = twistPh * (1.1 + 0.55 * sin(t * 0.7)) + divePh * 0.35;
  // Multi-axis feel via time-varying shear + rotation
  float shear = twistPh * 0.22 * sin(t * 1.3);
  vec2 q = p;
  q.x += q.y * shear;
  q.y += q.x * shear * 0.55;
  q *= rot(twist + t * 0.15 * twistPh);
  q *= zoom;

  // Continuous tunnel depth scroll
  float speed = mix(0.8, 6.5, divePh) * mix(1.0, 1.55, twistPh);
  float depth = t * speed;

  float g = 0.0;

  // --- 0–0.5: tiny center square flash ---
  float r0 = mix(0.008, 0.065, seedPh);
  float seed = squareFrame(p, r0, 0.006) * (1.0 - nestPh * 0.9);
  seed += squareFill(p, r0 * 0.35) * (0.6 + 0.4 * sin(t * 40.0)) * (1.0 - nestPh);
  seed += flash * squareFill(p, 0.04);

  // --- Nested expanding squares (0.5–2) then infinite tunnel ---
  // Log-space frames → infinite nested illusion
  float layers = mix(4.0, 28.0, nestPh + divePh * 0.5);
  float complexity = mix(1.0, 1.75, twistPh); // more angular detail later

  for (int i = 0; i < 32; i++) {
    float fi = float(i);
    if (fi >= layers) break;

    // Each layer is a square ring at log depth
    float z = fract(log(2.0 + fi) * 0.85 + depth * 0.12 + fi * 0.07);
    // Perspective scale: nearer = larger
    float scale = exp(-z * 2.8) * mix(1.2, 0.15, z);
    vec2 lp = q * scale;

    // Occasional diamond / octagon morph for complexity
    float morph = twistPh * 0.35 * sin(fi * 0.7 + t * 1.1);
    float dMax = mix(max(abs(lp.x), abs(lp.y)), mix(max(abs(lp.x), abs(lp.y)), (abs(lp.x) + abs(lp.y)) * 0.707, 0.5 + 0.5 * morph), complexity - 1.0);

    float rr = 0.42;
    float w = mix(0.012, 0.004, z) * mix(1.0, 0.7, twistPh);
    float frame = 1.0 - smoothstep(0.0, w, abs(dMax - rr));

    // Crosshair ticks on edges for mechanical feel
    float ticks = 0.0;
    ticks += (1.0 - smoothstep(0.0, 0.01, abs(abs(lp.x) - rr))) * step(abs(lp.y), rr * 0.12);
    ticks += (1.0 - smoothstep(0.0, 0.01, abs(abs(lp.y) - rr))) * step(abs(lp.x), rr * 0.12);
    ticks *= twistPh * 0.65;

    float layerGlow = (frame + ticks) * (1.0 - z * 0.55);
    // Nest phase reveals layers from center outward
    float reveal = smoothstep(0.0, 1.0, nestPh * 8.0 - fi * 0.35);
    g += layerGlow * reveal * (0.55 + 0.45 * divePh);
  }

  // Inner vanishing point core
  float core = exp(-dot(p, p) * mix(40.0, 8.0, divePh)) * divePh * 0.35;
  g += core;

  // --- Burst: concentric geometric explosion (9–12) ---
  float burst = 0.0;
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    float br = mix(0.02, 1.4, easeOut(burstPh)) * (0.12 + fi * 0.06);
    float bw = 0.01 + 0.004 * sin(t * 10.0 + fi);
    // Alternating square / diamond
    vec2 bp = p * rot(fi * 0.2 + burstPh * 1.5);
    float bd = mod(fi, 2.0) < 1.0 ? max(abs(bp.x), abs(bp.y)) : (abs(bp.x) + abs(bp.y)) * 0.707;
    burst += (1.0 - smoothstep(0.0, bw, abs(bd - br))) * burstPh * (1.0 - fi * 0.03);
  }
  // Screen fill wash at the end
  burst += burstPh * burstPh * 0.25 * (0.5 + 0.5 * sin(length(p) * 40.0 - t * 12.0));

  g = max(g * (1.0 - burstPh * 0.35), 0.0);
  g += seed + burst;
  g = clamp(g, 0.0, 1.8);

  float pulse = 0.9 + 0.1 * sin(t * 16.0 + length(p) * 8.0);
  vec3 col = NEON * g * pulse;
  col = min(col, NEON * 1.35);

  // Keep negative space pure black
  float crt = 0.94 + 0.06 * sin(uv.y * uRes.y * 1.1);
  col *= mix(1.0, crt, step(0.02, g));

  gl_FragColor = vec4(col, 1.0);
}
`;

export function Ekran2Battle() {
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
    ekran2Reset();
    ekran2MarkReady();
    return () => {
      ekran2Reset();
      mat.dispose();
    };
  }, [mat]);

  useFrame(() => {
    mat.uniforms.uT.value = ekran2T();
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

export function Ekran2Cam() {
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
