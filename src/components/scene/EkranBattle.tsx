import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EKRAN_SECONDS, ekranMarkReady, ekranReset, ekranT } from "../../ekranReel";

/**
 * 9:16 matrix takeover — black void, bright green bars from 4 corners.
 * First frame already has corner seeds (stop-scroll); new growth every beat
 * through ~3s; full green by ~12–15s.
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

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float easeOut(float x) {
  x = clamp(x, 0.0, 1.0);
  return 1.0 - pow(1.0 - x, 3.0);
}

float easeInOut(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * (3.0 - 2.0 * x);
}

// Soft bar: distance field for axis-aligned strip
float barH(vec2 p, float y0, float halfH, float x0, float x1) {
  float insideX = step(x0, p.x) * step(p.x, x1);
  float d = abs(p.y - y0) - halfH;
  return (1.0 - smoothstep(0.0, 0.004, d)) * insideX;
}

float barV(vec2 p, float x0, float halfW, float y0, float y1) {
  float insideY = step(y0, p.y) * step(p.y, y1);
  float d = abs(p.x - x0) - halfW;
  return (1.0 - smoothstep(0.0, 0.004, d)) * insideY;
}

void main() {
  // uv: 0..1, origin bottom-left; keep square-ish thickness via aspect
  vec2 uv = vUv;
  float aspect = uRes.x / max(uRes.y, 1.0);
  float t = uT;
  float u = clamp(t / uDur, 0.0, 1.0);

  // --- phases tuned for Reels scroll drop-off ---
  // 0–0.35: corner seeds + vertical race (stop)
  // 0.35–0.9: horizontals race (new beat)
  // 0.9–2.2: thicken + edge frame + rain kick-in
  // 2.2–6: secondary bars + cell crawl
  // 6–12: inward flood
  // 12–15: solid green lock

  float seed = 0.028;
  float thick0 = mix(0.012, 0.055, easeOut(clamp((t - 0.5) / 4.0, 0.0, 1.0)));
  float thick1 = mix(0.008, 0.09, easeOut(clamp((t - 2.0) / 6.0, 0.0, 1.0)));

  // Vertical growth from each corner (fast first hit)
  float vLen = easeOut(clamp(t / 0.55, 0.0, 1.0));
  // Horizontal growth slightly delayed — second beat inside first second
  float hLen = easeOut(clamp((t - 0.28) / 0.65, 0.0, 1.0));

  // Second wave length (keeps “what next?” alive after 2s)
  float vLen2 = easeOut(clamp((t - 1.6) / 2.2, 0.0, 1.0));
  float hLen2 = easeOut(clamp((t - 2.0) / 2.4, 0.0, 1.0));

  float g = 0.0;

  // Corner seed blocks — visible on frame 0
  float s = seed * (0.85 + 0.15 * sin(t * 28.0));
  g = max(g, step(uv.x, s) * step(uv.y, s));
  g = max(g, step(1.0 - s, uv.x) * step(uv.y, s));
  g = max(g, step(uv.x, s) * step(1.0 - s, uv.y));
  g = max(g, step(1.0 - s, uv.x) * step(1.0 - s, uv.y));

  // Primary L-bars from 4 corners
  // BL
  g = max(g, barV(uv, thick0 * 0.5, thick0 * 0.5, 0.0, vLen));
  g = max(g, barH(uv, thick0 * 0.5, thick0 * 0.5, 0.0, hLen));
  // BR
  g = max(g, barV(uv, 1.0 - thick0 * 0.5, thick0 * 0.5, 0.0, vLen));
  g = max(g, barH(uv, thick0 * 0.5, thick0 * 0.5, 1.0 - hLen, 1.0));
  // TL
  g = max(g, barV(uv, thick0 * 0.5, thick0 * 0.5, 1.0 - vLen, 1.0));
  g = max(g, barH(uv, 1.0 - thick0 * 0.5, thick0 * 0.5, 0.0, hLen));
  // TR
  g = max(g, barV(uv, 1.0 - thick0 * 0.5, thick0 * 0.5, 1.0 - vLen, 1.0));
  g = max(g, barH(uv, 1.0 - thick0 * 0.5, thick0 * 0.5, 1.0 - hLen, 1.0));

  // Secondary inset bars (new development ~2s)
  float inset = 0.08;
  g = max(g, barV(uv, inset + thick1 * 0.5, thick1 * 0.45, 0.0, vLen2) * step(1.4, t));
  g = max(g, barV(uv, 1.0 - inset - thick1 * 0.5, thick1 * 0.45, 0.0, vLen2) * step(1.4, t));
  g = max(g, barH(uv, inset + thick1 * 0.5, thick1 * 0.45, 0.0, hLen2) * step(1.8, t));
  g = max(g, barH(uv, 1.0 - inset - thick1 * 0.5, thick1 * 0.45, 1.0 - hLen2, 1.0) * step(1.8, t));
  g = max(g, barV(uv, inset + thick1 * 0.5, thick1 * 0.45, 1.0 - vLen2, 1.0) * step(1.4, t));
  g = max(g, barV(uv, 1.0 - inset - thick1 * 0.5, thick1 * 0.45, 1.0 - vLen2, 1.0) * step(1.4, t));
  g = max(g, barH(uv, inset + thick1 * 0.5, thick1 * 0.45, 0.0, hLen2) * step(1.8, t));
  g = max(g, barH(uv, 1.0 - inset - thick1 * 0.5, thick1 * 0.45, 0.0, hLen2) * step(1.8, t));

  // Mid-edge third wave — crosses toward center after ~3s
  float mid = easeOut(clamp((t - 3.0) / 4.5, 0.0, 1.0));
  float midT = mix(0.01, 0.07, mid);
  g = max(g, barH(uv, 0.5, midT, 0.0, mid) * step(3.0, t));
  g = max(g, barH(uv, 0.5, midT, 1.0 - mid, 1.0) * step(3.0, t));
  g = max(g, barV(uv, 0.5, midT * aspect, 0.0, mid) * step(3.2, t));
  g = max(g, barV(uv, 0.5, midT * aspect, 1.0 - mid, 1.0) * step(3.2, t));

  // Matrix rain — columns fall near claimed edges
  float rainOn = easeOut(clamp((t - 0.7) / 1.2, 0.0, 1.0));
  float cols = 28.0;
  float col = floor(uv.x * cols);
  float cell = floor(uv.y * 48.0);
  float speed = 2.2 + hash(vec2(col, 0.3)) * 3.5;
  float head = fract(hash(vec2(col, 2.1)) + t * speed);
  float trail = fract(head - uv.y);
  float rain = rainOn * (1.0 - smoothstep(0.0, 0.35, trail)) * step(0.55, hash(vec2(col, cell + floor(t * 14.0))));
  // Only rain where bars already claimed or near edges
  float edgeNear = max(
    max(1.0 - uv.x * 4.0, uv.x * 4.0 - 3.0),
    max(1.0 - uv.y * 4.0, uv.y * 4.0 - 3.0)
  );
  edgeNear = clamp(edgeNear, 0.0, 1.0);
  float claimed = max(g, edgeNear * rainOn);
  g = max(g, rain * claimed);

  // Cell fill from corners inward (the “screen writing” takeover)
  float fill = easeInOut(clamp((t - 4.0) / 8.0, 0.0, 1.0));
  float gx = floor(uv.x * 18.0);
  float gy = floor(uv.y * 32.0);
  float dCorner = min(
    min(length(uv), length(uv - vec2(1.0, 0.0))),
    min(length(uv - vec2(0.0, 1.0)), length(uv - vec2(1.0, 1.0)))
  );
  float cellGate = step(dCorner, mix(0.05, 1.45, fill));
  float cellFlick = step(0.22, hash(vec2(gx, gy) + floor(t * 6.0)));
  g = max(g, cellGate * cellFlick * fill);

  // Final flood to solid green
  float flood = easeInOut(clamp((t - 11.2) / 3.2, 0.0, 1.0));
  g = max(g, flood);

  // Bright matrix green on black
  vec3 neon = vec3(0.05, 1.0, 0.28);
  vec3 dim = vec3(0.0, 0.22, 0.06);
  float pulse = 0.92 + 0.08 * sin(t * 11.0 + uv.y * 20.0);
  vec3 colrgb = mix(vec3(0.0), mix(dim, neon, pulse), clamp(g, 0.0, 1.0));

  // Scanline / CRT bite for “what is this” feel
  float scan = 0.92 + 0.08 * sin(uv.y * uRes.y * 1.2 + t * 18.0);
  colrgb *= scan;

  // Early flash on seeds so frame 0 pops
  float flash = (1.0 - smoothstep(0.0, 0.18, t)) * 0.55;
  colrgb += neon * flash * g;

  gl_FragColor = vec4(colrgb, 1.0);
}
`;

export function EkranBattle() {
  const size = useThree((s) => s.size);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uT: { value: 0 },
          uDur: { value: EKRAN_SECONDS },
          uRes: { value: new THREE.Vector2(1080, 1920) },
        },
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    ekranReset();
    ekranMarkReady();
    return () => {
      ekranReset();
      mat.dispose();
    };
  }, [mat]);

  useFrame(() => {
    mat.uniforms.uT.value = ekranT();
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

export function EkranCam() {
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
