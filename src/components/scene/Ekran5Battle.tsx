import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EKRAN5_SECONDS, ekran5MarkReady, ekran5Reset, ekran5T } from "../../ekran5Reel";

/**
 * 12s hypnotic concentric rings — #39FF14 on black.
 * Loop-friendly: end flood eases toward a state that reads like the opening pulse.
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
uniform float uDur;
uniform vec2 uRes;

const vec3 NEON = vec3(0.222, 1.0, 0.078);

float easeOut(float x) {
  x = clamp(x, 0.0, 1.0);
  return 1.0 - pow(1.0 - x, 3.0);
}

float easeInOut(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * (3.0 - 2.0 * x);
}

float sdRing(vec2 p, float r, float w) {
  return abs(length(p) - r) - w;
}

void main() {
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(1.0, 1.0 / aspect);
  float t = uT;
  float ang = atan(p.y, p.x);
  float dist = length(p);

  // Loop blend near end → soft return toward center ring feel
  float loopIn = easeInOut(clamp((t - (uDur - 1.1)) / 1.1, 0.0, 1.0));

  float flash = 1.0 - smoothstep(0.0, 0.08, t);
  float ring0Ph = easeOut(clamp(t / 0.5, 0.0, 1.0));                 // 0–0.5
  float multiPh = easeOut(clamp((t - 0.4) / 1.5, 0.0, 1.0));          // 0.5–2
  float spokesPh = easeInOut(clamp((t - 1.8) / 2.2, 0.0, 1.0));       // 2–4
  float breathPh = easeInOut(clamp((t - 3.8) / 3.2, 0.0, 1.0));       // 4–7
  float complexPh = easeInOut(clamp((t - 6.8) / 3.2, 0.0, 1.0));      // 7–10
  float fillPh = easeInOut(clamp((t - 9.8) / 2.0, 0.0, 1.0));         // 10–12
  fillPh *= (1.0 - loopIn * 0.85);

  // Depth tunnel feel: slight radial zoom oscillation
  float breath = 1.0 + breathPh * 0.18 * sin(t * 2.6);
  float depthZoom = mix(1.0, 1.35, breathPh) * mix(1.0, 1.25, complexPh);
  vec2 q = p * breath * depthZoom;

  float g = 0.0;

  // --- First ring: immediate rotation from frame 0 ---
  float spin0 = t * 4.5;
  float r0 = mix(0.04, 0.11, ring0Ph) * (0.85 + 0.2 * sin(t * 8.0));
  float w0 = 0.008;
  float d0 = sdRing(q, r0, w0);
  float first = (1.0 - smoothstep(0.0, 0.004, d0)) * (0.7 + 0.3 * ring0Ph);
  // Rotating tick on the ring
  float tick = pow(0.5 + 0.5 * cos(ang * 1.0 - spin0), 24.0) * first;
  first += tick * 0.8 + flash * exp(-dist * dist * 80.0);

  // --- Concentric rings alternating directions ---
  float rings = 0.0;
  float nRings = mix(3.0, 16.0, multiPh);
  for (int i = 0; i < 18; i++) {
    float fi = float(i);
    if (fi >= nRings) break;
    float dir = mod(fi, 2.0) < 1.0 ? 1.0 : -1.0;
    float speed = (2.2 + fi * 0.35) * dir * mix(1.0, 2.4, breathPh);
    float spin = t * speed;
    // Size pulse / change
    float baseR = 0.06 + fi * 0.045;
    float pulseR = baseR * (1.0 + 0.12 * sin(t * (3.0 + fi * 0.4) + fi) * multiPh);
    pulseR *= mix(1.0, 0.75 + 0.45 * sin(t * 2.0 + fi * 0.7), breathPh);
    float w = mix(0.0045, 0.0025, fi / 16.0);
    float rd = sdRing(q, pulseR, w);
    float ring = (1.0 - smoothstep(0.0, 0.0035, rd));
    // Dashed segments for mechanical feel
    float dash = 0.5 + 0.5 * cos(ang * (6.0 + fi) - spin);
    dash = smoothstep(0.15, 0.55, dash);
    float reveal = smoothstep(0.0, 1.0, multiPh * 10.0 - fi * 0.55);
    rings += ring * mix(1.0, dash, 0.65) * reveal * (1.0 - fi * 0.02);
  }

  // --- Spokes / geometric lines between rings (optical vortex) ---
  float spokes = 0.0;
  float nSpokes = mix(12.0, 72.0, spokesPh);
  for (int i = 0; i < 72; i++) {
    float fi = float(i);
    if (fi >= nSpokes) break;
    float a0 = fi * 6.2832 / nSpokes + t * (mod(fi, 2.0) < 1.0 ? 0.4 : -0.55) * spokesPh;
    float across = abs(sin(ang - a0));
    // Only between inner and outer ring band
    float band = smoothstep(0.05, 0.1, dist) * (1.0 - smoothstep(0.55, 0.85, dist * depthZoom));
    float line = (1.0 - smoothstep(0.0, 0.012, across)) * band;
    // Cross-hatch secondary set
    float a1 = a0 + 0.04;
    float across2 = abs(sin(ang - a1));
    float line2 = (1.0 - smoothstep(0.0, 0.008, across2)) * band * 0.45;
    spokes += (line + line2) * spokesPh * (0.35 + 0.65 * complexPh);
  }

  // Hypnotic spiral overlay
  float spiral = 0.5 + 0.5 * cos(ang * 8.0 - dist * 28.0 + t * 5.0);
  spiral = pow(smoothstep(0.55, 1.0, spiral), 2.0) * spokesPh * 0.35 * (1.0 - smoothstep(0.7, 1.1, dist));

  // Center void deepening
  float tunnel = exp(-dist * mix(6.0, 2.5, breathPh)) * breathPh * 0.25;
  // Moire / interference for complexity (soft, not flicker-heavy)
  float moire = 0.5 + 0.5 * cos(dist * 60.0 - t * 3.0) * cos(ang * 16.0 + t * 2.0);
  moire = smoothstep(0.65, 0.95, moire) * complexPh * 0.3 * (1.0 - fillPh);

  // Symmetry field expanding
  float field = 0.0;
  field += (1.0 - smoothstep(0.0, 0.01, abs(mod(dist * 12.0 - t * 1.5, 1.0) - 0.5) - 0.02)) * complexPh * 0.4;
  field += spokes * 0.15;

  // Outward fill (10–12) then loop softens back
  float fill = fillPh * (0.55 + 0.45 * (0.5 + 0.5 * sin(dist * 40.0 - t * 8.0)));
  fill *= smoothstep(0.0, 0.9, dist * 0.5 + fillPh);

  // Opening ring reconstituted for loop
  float loopRing = (1.0 - smoothstep(0.0, 0.005, abs(dist - 0.08))) * loopIn * 0.9;

  g = first + rings + spokes * 0.55 + spiral + tunnel + moire + field + fill + loopRing;
  g = clamp(g, 0.0, 1.75);

  // Smooth brightness — avoid harsh flicker
  float pulse = 0.94 + 0.06 * sin(t * 6.0);
  vec3 col = NEON * g * pulse;
  col = min(col, NEON * 1.3);

  gl_FragColor = vec4(col, 1.0);
}
`;

export function Ekran5Battle() {
  const size = useThree((s) => s.size);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uT: { value: 0 },
          uDur: { value: EKRAN5_SECONDS },
          uRes: { value: new THREE.Vector2(1080, 1920) },
        },
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    ekran5Reset();
    ekran5MarkReady();
    return () => {
      ekran5Reset();
      mat.dispose();
    };
  }, [mat]);

  useFrame(() => {
    mat.uniforms.uT.value = ekran5T();
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

export function Ekran5Cam() {
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
