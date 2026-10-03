import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { REEL_HOLD } from "../../recordCanvas";
import { breathSlots, dragonAt, dragonBreathIndex, dragonBreaths } from "../../dragonReel";

function placed(src: THREE.BufferGeometry, color: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = src.clone();
  g.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz)
    )
  );
  const c = new THREE.Color(color);
  const n = g.getAttribute("position").count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function wingGeo(sign: number) {
  const pts = [
    [0, 0.15, 0.15],
    [sign * 1.15, 0.42, 0.95],
    [sign * 2.7, 0.55, 0.62],
    [sign * 4.55, 0.22, -0.2],
    [sign * 3.7, -0.02, -1.45],
    [sign * 1.85, -0.08, -1.2],
    [sign * 0.4, 0.02, -0.5],
  ];
  const leather = new THREE.Color("#6a342c");
  const leather2 = new THREE.Color("#8c4c38");
  const positions: number[] = [];
  const colors: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const tri = [pts[0], pts[i], pts[i + 1]];
    const c = i % 2 === 0 ? leather : leather2;
    for (const p of tri) {
      positions.push(p[0], p[1], p[2]);
      colors.push(c.r, c.g, c.b);
    }
  }
  const membrane = new THREE.BufferGeometry();
  membrane.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  membrane.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  membrane.computeVertexNormals();
  const bone = new THREE.CylinderGeometry(0.045, 0.07, 1, 5);
  const spars = [
    placed(bone, "#3a3228", sign * 1.3, 0.28, 0.45, 0, 0, sign * 1.15, 1, 2.5, 1),
    placed(bone, "#3a3228", sign * 2.5, 0.32, 0.15, 0.15, 0, sign * 0.85, 1, 3.1, 1),
    placed(bone, "#2c261e", sign * 2.2, 0.05, -0.7, -0.4, 0, sign * 0.7, 1, 2.4, 1),
  ].map((g) => {
    const flat = g.toNonIndexed();
    g.dispose();
    return flat;
  });
  bone.dispose();
  const merged = mergeGeometries([membrane, ...spars], false);
  membrane.dispose();
  spars.forEach((g) => g.dispose());
  return merged ?? new THREE.BufferGeometry();
}

function buildBody() {
  const sphere = new THREE.SphereGeometry(0.5, 12, 9);
  const cone = new THREE.ConeGeometry(0.16, 0.55, 6);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const parts: THREE.BufferGeometry[] = [];
  const dorsal = ["#4a4336", "#5c5342", "#3e382e", "#6a5e48"];
  const zs = [-2.7, -1.9, -1.05, -0.15, 0.7, 1.35];
  const rs = [0.34, 0.48, 0.58, 0.62, 0.5, 0.36];
  zs.forEach((z, i) => {
    parts.push(placed(sphere, dorsal[i % dorsal.length], 0, 0.05, z, 0, 0, 0, rs[i] * 1.15, rs[i], rs[i] * 1.25));
    parts.push(placed(sphere, "#c6aa72", 0, -rs[i] * 0.42, z, 0, 0, 0, rs[i] * 0.72, rs[i] * 0.38, rs[i] * 0.9));
    if (i > 0 && i < 5) parts.push(placed(cone, "#2a241c", 0, rs[i] * 0.85, z, 0, 0, 0, 0.7, 0.85, 0.7));
  });
  parts.push(placed(sphere, "#5a5142", 0, 0.42, 1.85, -0.4, 0, 0, 0.32, 0.34, 0.48));
  parts.push(placed(sphere, "#4e4638", 0, 0.72, 2.35, -0.2, 0, 0, 0.38, 0.32, 0.42));
  parts.push(placed(sphere, "#3f382e", 0, 0.78, 2.72, 0, 0, 0, 0.36, 0.3, 0.46));
  parts.push(placed(box, "#6b5b40", 0, 0.62, 3.15, 0, 0, 0, 0.22, 0.16, 0.55));
  parts.push(placed(cone, "#241e16", -0.16, 1.05, 2.55, 0.4, 0, 0.5, 0.85, 1.15, 0.85));
  parts.push(placed(cone, "#241e16", 0.16, 1.05, 2.55, 0.4, 0, -0.5, 0.85, 1.15, 0.85));
  parts.push(placed(cone, "#1a1612", 0, 1.12, 2.15, -0.8, 0, 0, 0.7, 0.9, 0.7));
  const leg = new THREE.CylinderGeometry(0.08, 0.1, 0.7, 6);
  parts.push(placed(leg, "#3a342c", -0.38, -0.35, 0.55, 0.5, 0, 0.3, 1, 1, 1));
  parts.push(placed(leg, "#3a342c", 0.38, -0.35, 0.55, 0.5, 0, -0.3, 1, 1, 1));
  parts.push(placed(leg, "#3a342c", -0.32, -0.28, -1.15, 0.7, 0, 0.2, 0.85, 0.9, 0.85));
  parts.push(placed(leg, "#3a342c", 0.32, -0.28, -1.15, 0.7, 0, -0.2, 0.85, 0.9, 0.85));
  const merged = mergeGeometries(parts, false);
  sphere.dispose();
  cone.dispose();
  box.dispose();
  leg.dispose();
  parts.forEach((g) => g.dispose());
  return merged;
}

function buildJaw() {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cone = new THREE.ConeGeometry(0.05, 0.16, 4);
  const parts = [
    placed(box, "#c6aa72", 0, -0.08, 0.42, 0, 0, 0, 0.2, 0.08, 0.55),
    placed(cone, "#efe6d4", -0.06, 0.02, 0.22, Math.PI, 0, 0, 1, 1, 1),
    placed(cone, "#efe6d4", 0.06, 0.02, 0.22, Math.PI, 0, 0, 1, 1, 1),
    placed(cone, "#efe6d4", -0.06, 0.02, 0.4, Math.PI, 0, 0, 0.8, 0.9, 0.8),
    placed(cone, "#efe6d4", 0.06, 0.02, 0.4, Math.PI, 0, 0, 0.8, 0.9, 0.8),
  ];
  const merged = mergeGeometries(parts, false);
  box.dispose();
  cone.dispose();
  parts.forEach((g) => g.dispose());
  return merged;
}

function GroundFire({ ax, az, t0, dur, armed }: { ax: number; az: number; t0: number; dur: number; armed: boolean }) {
  const scorch = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const u = (t - t0) / dur;
    const live = armed && u > 0 && u < 1 ? Math.sin(Math.min(1, Math.max(0, u)) * Math.PI) : 0;
    const burn = armed && t > t0 ? Math.min(0.72, ((t - t0) / 0.8) * 0.72) : 0;
    if (scorch.current) scorch.current.opacity = burn * (t > t0 + 2.4 ? 0.55 : 1);
    if (ring.current) ring.current.opacity = live * 0.9;
  });
  return (
    <group position={[ax, 0.08, az]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[5.4, 24]} />
        <meshBasicMaterial ref={scorch} color="#140c08" transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.8, 4.8, 22]} />
        <meshBasicMaterial ref={ring} color="#ff5a12" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function Dragon({ soldiers }: { soldiers: number }) {
  const root = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Group>(null);
  const tails = useRef<Array<THREE.Group | null>>([]);
  const embers = useRef<THREE.InstancedMesh>(null);
  const mouth = useRef<THREE.PointLight>(null);
  const ground = useRef<THREE.PointLight>(null);
  const body = useMemo(() => buildBody(), []);
  const jawGeo = useMemo(() => buildJaw(), []);
  const wings = useMemo(() => [wingGeo(1), wingGeo(-1)] as const, []);
  const tailGeo = useMemo(() => new THREE.SphereGeometry(0.5, 8, 6), []);
  const emberDummy = useMemo(() => new THREE.Object3D(), []);
  const slots = breathSlots(Math.max(1, soldiers));

  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const p = dragonAt(t);
    const idx = dragonBreathIndex(t);
    const breath = idx >= 0 && idx < slots ? p.breath : 0;
    if (root.current) {
      root.current.position.set(p.x, p.y + Math.sin(t * 2.2) * 0.16, p.z);
      root.current.rotation.set(p.pitch, p.yaw, p.roll);
    }
    const gliding = breath > 0.2;
    const flap = Math.sin(t * (gliding ? 2.4 : 5.6));
    const amp = gliding ? 0.16 : 0.5;
    if (left.current) left.current.rotation.z = 0.42 + flap * amp;
    if (right.current) right.current.rotation.z = -0.42 - flap * amp;
    if (jaw.current) jaw.current.rotation.x = -0.08 - breath * 0.78;
    tails.current.forEach((seg, i) => {
      if (!seg) return;
      seg.rotation.y = Math.sin(t * 3.2 - i * 0.75) * (0.16 + i * 0.04);
      seg.rotation.x = 0.12 + Math.sin(t * 2.1 - i) * 0.05;
    });
    if (flame.current) {
      const flick = 0.9 + Math.sin(t * 29) * 0.07 + Math.sin(t * 17.5) * 0.05;
      const s = breath * flick;
      flame.current.visible = s > 0.03;
      flame.current.scale.set(0.35 + s * 0.9, 0.35 + s * 0.9, 0.2 + s * 1.15);
    }
    if (mouth.current) mouth.current.intensity = breath * 16;
    if (ground.current) {
      ground.current.intensity = breath * 22;
      ground.current.position.set(p.aimX, 1.3, p.aimZ);
    }
    const mesh = embers.current;
    if (mesh) {
      const n = 48;
      for (let i = 0; i < n; i++) {
        const speed = 1.6 + (i % 6) * 0.18;
        const u = (t * speed + i * 0.17) % 1;
        if (breath < 0.04) emberDummy.scale.setScalar(0);
        else {
          const spread = ((i % 9) - 4) * 0.09 * u;
          const side = ((Math.floor(i / 9) % 3) - 1) * 0.07 * u;
          emberDummy.position.set(spread, -0.22 - u * 1.15 + side, 0.35 + u * 6.4);
          emberDummy.scale.setScalar((1 - u) * (0.16 + (i % 4) * 0.045) * breath);
        }
        emberDummy.updateMatrix();
        mesh.setMatrixAt(i, emberDummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <group ref={root} scale={1.72}>
        {body && (
          <mesh geometry={body}>
            <meshStandardMaterial vertexColors roughness={0.52} metalness={0.16} />
          </mesh>
        )}
        <mesh position={[0.14, 0.9, 2.62]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <meshBasicMaterial color="#ffb020" />
        </mesh>
        <mesh position={[-0.14, 0.9, 2.62]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <meshBasicMaterial color="#ffb020" />
        </mesh>
        <group ref={jaw} position={[0, 0.58, 2.85]}>
          {jawGeo && (
            <mesh geometry={jawGeo}>
              <meshStandardMaterial vertexColors roughness={0.58} metalness={0.08} />
            </mesh>
          )}
        </group>
        <group ref={left} position={[0.35, 0.28, 0.35]}>
          {wings[0] && (
            <mesh geometry={wings[0]}>
              <meshStandardMaterial vertexColors roughness={0.72} metalness={0.04} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
        <group ref={right} position={[-0.35, 0.28, 0.35]}>
          {wings[1] && (
            <mesh geometry={wings[1]}>
              <meshStandardMaterial vertexColors roughness={0.72} metalness={0.04} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
        {[0, 1, 2, 3, 4].map((i) => (
          <group
            key={i}
            ref={(node) => {
              tails.current[i] = node;
            }}
            position={[0, 0.02 - i * 0.04, -2.55 - i * 0.72]}
          >
            <mesh geometry={tailGeo} scale={[0.42 - i * 0.06, 0.32 - i * 0.04, 0.55]}>
              <meshStandardMaterial color={i % 2 ? "#5c5342" : "#3e382e"} roughness={0.55} metalness={0.12} />
            </mesh>
          </group>
        ))}
        <group ref={flame} position={[0, 0.55, 3.2]} rotation={[-0.42, 0, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 3.5]}>
            <coneGeometry args={[1.05, 7.4, 14, 1, true]} />
            <meshBasicMaterial color="#ff4a08" transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 2.8]} scale={[0.48, 0.78, 0.48]}>
            <coneGeometry args={[0.85, 6.4, 12, 1, true]} />
            <meshBasicMaterial color="#ffe6a0" transparent opacity={0.75} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 1.15]}>
            <coneGeometry args={[0.42, 2.2, 10, 1, true]} />
            <meshBasicMaterial color="#fff1c4" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
          <instancedMesh ref={embers} args={[undefined, undefined, 48]}>
            <sphereGeometry args={[0.18, 5, 4]} />
            <meshBasicMaterial color="#ffb020" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
          </instancedMesh>
          <pointLight ref={mouth} color="#ff7a2a" intensity={0} distance={14} decay={2} />
        </group>
      </group>
      <pointLight ref={ground} color="#ff6a1a" intensity={0} distance={16} decay={2} />
      {dragonBreaths().map((b, i) => (
        <GroundFire key={i} ax={b.ax} az={b.az} t0={b.t0} dur={b.dur} armed={i < slots} />
      ))}
    </group>
  );
}
