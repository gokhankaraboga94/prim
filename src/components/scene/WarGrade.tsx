import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * War-film grade baked into the canvas. Must run at useFrame priority 1.
 * drei Hud at priority 1 re-renders the ungraded scene — overlays must be 2+.
 */
export function WarGrade() {
  const { gl, scene, camera, size } = useThree();
  const pass = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(4, 4, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
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

        void main() {
          vec3 col = texture2D(tDiffuse, vUv).rgb;
          float y = luma(col);
          col = mix(vec3(y), col, 0.34);

          vec3 shadow = vec3(0.52, 0.70, 0.62);
          vec3 mid = vec3(1.05, 0.96, 0.74);
          vec3 high = vec3(1.28, 1.02, 0.62);
          float s = smoothstep(0.05, 0.38, y);
          float h = smoothstep(0.42, 0.86, y);
          col *= mix(shadow, mix(mid, high, h), s);

          col = (col - 0.5) * 1.38 + 0.40;
          col = pow(max(col, 0.0), vec3(1.12));
          col.g *= 1.06;
          col.b *= 0.82;

          vec2 p = vUv * 2.0 - 1.0;
          p.x *= resolution.x / max(resolution.y, 1.0);
          float vig = 1.0 - dot(p, p) * 0.32;
          col *= clamp(vig, 0.28, 1.0);

          vec2 gp = gl_FragCoord.xy + time * 37.0;
          float n = fract(sin(dot(gp, vec2(12.9898, 78.233))) * 43758.5453);
          col += (n - 0.5) * 0.08;

          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
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
    const prev = gl.toneMappingExposure;
    gl.toneMappingExposure = 1.05;
    return () => {
      gl.toneMappingExposure = prev;
      pass.rt.dispose();
      pass.mat.dispose();
      pass.quad.geometry.dispose();
    };
  }, [gl, pass]);

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
    gl.setRenderTarget(pass.rt);
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.render(scene, camera);

    gl.setRenderTarget(null);
    gl.toneMapping = THREE.NoToneMapping;
    gl.render(pass.fsScene, pass.fsCam);
    gl.toneMapping = prevTone;
  }, 1);

  return null;
}
