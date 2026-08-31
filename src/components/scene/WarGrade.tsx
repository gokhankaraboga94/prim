import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Bleach-bypass / ENR grade (Saving Private Ryan, 1917).
 * Takes over render at priority 1 — Hud overlays must be 2+.
 */
export function WarGrade() {
  const { gl, scene, camera, size } = useThree();
  const pass = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(4, 4, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    rt.texture.generateMipmaps = false;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: rt.texture },
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(4, 4) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform vec2 resolution;
        varying vec2 vUv;

        float luma(vec3 c) {
          return dot(c, vec3(0.2126, 0.7152, 0.0722));
        }

        vec3 aces(vec3 x) {
          return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
        }

        vec3 overlay(vec3 base, vec3 blend) {
          vec3 low = 2.0 * base * blend;
          vec3 high = 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
          vec3 m = step(vec3(0.5), base);
          return mix(low, high, m);
        }

        void main() {
          vec3 src = texture2D(tDiffuse, vUv).rgb;
          float y0 = luma(src);
          vec3 col = y0 < 0.09 ? aces(src * 2.6) : src;

          float y = luma(col);
          vec3 grey = vec3(y);
          col = mix(grey, col, 0.32);

          vec3 silver = overlay(col, grey);
          col = mix(col, silver, 0.55);
          col = (col - 0.5) * 1.42 + 0.47;

          vec3 shadow = vec3(0.72, 0.92, 0.86);
          vec3 mid = vec3(1.08, 1.04, 0.78);
          vec3 high = vec3(1.22, 1.10, 0.70);
          float s = smoothstep(0.10, 0.42, y);
          float h = smoothstep(0.45, 0.82, y);
          col *= mix(shadow, mix(mid, high, h), s);

          col.r *= 1.06;
          col.g *= 1.10;
          col.b *= 0.78;

          col = mix(col, vec3(y * 1.05), 0.12);
          col = max(col, vec3(0.035));

          vec2 p = vUv * 2.0 - 1.0;
          p.x *= resolution.x / max(resolution.y, 1.0);
          float vig = 1.0 - dot(p, p) * 0.24;
          col *= mix(0.55, 1.0, clamp(vig, 0.0, 1.0));

          float n = fract(sin(dot(gl_FragCoord.xy + time * 41.0, vec2(12.9898, 78.233))) * 43758.5453);
          col += (n - 0.5) * 0.07;

          gl_FragColor = vec4(clamp(col, 0.03, 1.0), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    const fsScene = new THREE.Scene();
    fsScene.add(quad);
    const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { rt, mat, quad, fsScene, fsCam };
  }, []);

  useEffect(() => {
    return () => {
      pass.rt.dispose();
      pass.mat.dispose();
      pass.quad.geometry.dispose();
    };
  }, [pass]);

  useFrame((state) => {
    const dpr = gl.getPixelRatio();
    const w = Math.max(1, Math.floor(size.width * dpr));
    const h = Math.max(1, Math.floor(size.height * dpr));
    if (pass.rt.width !== w || pass.rt.height !== h) {
      pass.rt.setSize(w, h);
      pass.mat.uniforms.resolution.value.set(w, h);
    }
    pass.mat.uniforms.time.value = state.clock.elapsedTime;

    const prevTone = gl.toneMapping;
    const prevOut = gl.outputColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    gl.setRenderTarget(pass.rt);
    gl.render(scene, camera);

    gl.setRenderTarget(null);
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.render(pass.fsScene, pass.fsCam);
    gl.toneMapping = prevTone;
    gl.outputColorSpace = prevOut;
  }, 1);

  return null;
}
