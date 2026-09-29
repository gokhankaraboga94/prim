import { useMemo, useRef } from "react";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { formatCount } from "../../game";
import { REEL_HOLD } from "../../recordCanvas";
import { devAlive, devClubHit, devGiantAt, devMaceSwing, devSwordPose } from "../../devReel";

const dummy = new THREE.Object3D();
const ARROWS = 18;

function GiantBody({ soldiers, big, sword }: { soldiers: number; big: boolean; sword: boolean }) {
  const root = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const mace = useRef<THREE.Group>(null);
  const blade = useRef<THREE.Group>(null);
  const plate = useMemo(() => new THREE.MeshStandardMaterial({ color: "#121216", metalness: 0.78, roughness: 0.32 }), []);
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a2a30", metalness: 0.7, roughness: 0.4 }), []);
  const slit = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ff2a14", emissive: "#ff1a10", emissiveIntensity: 1.4, roughness: 0.4 }), []);
  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const g = devGiantAt(t);
    if (big) {
      const s = devMaceSwing(t, soldiers);
      const step = Math.abs(Math.sin(t * 5.6)) * 0.18;
      const fx = Math.sin(g.yaw);
      const fz = Math.cos(g.yaw);
      if (root.current) {
        root.current.position.set(g.x + fx * s.lunge * 1.6, step - s.dip, g.z + fz * s.lunge * 1.6);
        root.current.rotation.y = g.yaw + s.twist;
        root.current.rotation.z = s.sweep * 0.07;
      }
      if (sword) {
        const slash = devSwordPose(t);
        if (arm.current) {
          arm.current.rotation.x = slash.armX;
          arm.current.rotation.z = slash.armZ;
        }
        if (blade.current) blade.current.rotation.x = slash.blade;
      } else if (arm.current) {
        arm.current.rotation.x = 0;
        arm.current.rotation.z = 0.16 - s.twist * 0.6;
      }
      if (mace.current) {
        mace.current.rotation.x = s.pitch;
        mace.current.rotation.y = s.sweep * 0.22;
        mace.current.rotation.z = s.sweep;
      }
    } else {
      const hit = devClubHit(t, soldiers);
      const pace = Math.sin(t * 7.2);
      if (root.current) {
        root.current.position.set(g.x, Math.abs(Math.sin(t * 5.6)) * 0.32, g.z);
        root.current.rotation.y = g.yaw;
        root.current.rotation.z = pace * 0.045;
      }
      if (arm.current) {
        arm.current.rotation.x = 0;
        arm.current.rotation.z = 0.14 + pace * 0.22 - hit * 0.42;
      }
      if (mace.current) {
        mace.current.rotation.x = -0.12 - hit * 2.25;
        mace.current.rotation.y = 0;
        mace.current.rotation.z = 0;
      }
    }
  });
  const spikes = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <group ref={root} scale={big ? 1.52 : 1}>
      <mesh position={[-1.15, 3.1, 0.15]} material={plate}>
        <cylinderGeometry args={[0.72, 0.95, 5.4, 6]} />
      </mesh>
      <mesh position={[1.15, 3.1, 0.15]} material={plate}>
        <cylinderGeometry args={[0.72, 0.95, 5.4, 6]} />
      </mesh>
      <mesh position={[-1.15, 0.45, 0.35]} material={iron}>
        <boxGeometry args={[1.35, 0.7, 2.1]} />
      </mesh>
      <mesh position={[1.15, 0.45, 0.35]} material={iron}>
        <boxGeometry args={[1.35, 0.7, 2.1]} />
      </mesh>
      <mesh position={[0, 6.15, 0.05]} material={plate}>
        <boxGeometry args={[4.4, 1.5, 2.3]} />
      </mesh>
      <mesh position={[0, 9.15, 0]} material={plate}>
        <boxGeometry args={[4.1, 4.6, 2.35]} />
      </mesh>
      <mesh position={[0, 11.7, 0.15]} material={iron}>
        <boxGeometry args={[3.3, 0.55, 2.5]} />
      </mesh>
      <mesh position={[-2.55, 10.7, 0]} rotation={[0, 0, 0.35]} material={plate}>
        <boxGeometry args={[1.7, 0.55, 2.2]} />
      </mesh>
      <mesh position={[2.55, 10.7, 0]} rotation={[0, 0, -0.35]} material={plate}>
        <boxGeometry args={[1.7, 0.55, 2.2]} />
      </mesh>
      <mesh position={[-3.15, 11.15, 0]} rotation={[0, 0, 0.4]} material={iron}>
        <coneGeometry args={[0.28, 1.15, 5]} />
      </mesh>
      <mesh position={[3.15, 11.15, 0]} rotation={[0, 0, -0.4]} material={iron}>
        <coneGeometry args={[0.28, 1.15, 5]} />
      </mesh>
      <mesh position={[0, 13.55, 0.05]} material={plate}>
        <cylinderGeometry args={[1.25, 1.55, 2.5, 8]} />
      </mesh>
      <mesh position={[0, 15.15, 0.05]} material={iron}>
        <cylinderGeometry args={[0.35, 1.35, 1.15, 8]} />
      </mesh>
      {spikes.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <mesh key={deg} position={[Math.sin(rad) * 1.2, 14.9, Math.cos(rad) * 1.2]} rotation={[Math.cos(rad) * 0.9, 0, -Math.sin(rad) * 0.9]} material={iron}>
            <coneGeometry args={[0.16, 1.15, 4]} />
          </mesh>
        );
      })}
      <mesh position={[0, 13.35, 1.22]} material={slit}>
        <boxGeometry args={[1.15, 0.12, 0.08]} />
      </mesh>
      <group ref={arm} position={[-2.7, 10.4, 0.2]}>
        <mesh position={[-0.25, -1.7, 0.2]} rotation={[0.2, 0, 0.15]} material={plate}>
          <cylinderGeometry args={[0.42, 0.55, 3.2, 6]} />
        </mesh>
        {sword && (
          <group ref={blade} position={[-0.4, -3.25, 0.45]}>
            <mesh position={[0, 0, 0.32]} material={iron}>
              <boxGeometry args={[0.34, 0.34, 0.55]} />
            </mesh>
            <mesh position={[0, 0, 0.72]} material={plate}>
              <boxGeometry args={[1.25, 0.26, 0.32]} />
            </mesh>
            <mesh position={[0, 0, 2.45]} material={iron}>
              <boxGeometry args={[0.34, 0.16, 3.3]} />
            </mesh>
          </group>
        )}
      </group>
      <group ref={mace} position={[2.7, 10.5, 0.25]}>
        <mesh position={[0.25, -1.5, 0.55]} rotation={[0.55, 0, -0.1]} material={plate}>
          <cylinderGeometry args={[0.48, 0.62, 3.1, 6]} />
        </mesh>
        <mesh position={[0.45, -2.2, 4.6]} rotation={[1.2, 0, 0]} material={iron}>
          <cylinderGeometry args={[0.22, 0.28, 7.4, 6]} />
        </mesh>
        <mesh position={[0.7, -2.7, 8.2]} rotation={[1.2, 0, 0]} material={plate}>
          <sphereGeometry args={[1.15, 8, 6]} />
        </mesh>
        <mesh position={[0.7, -1.5, 8.2]} material={iron}>
          <coneGeometry args={[0.28, 1.1, 4]} />
        </mesh>
        <mesh position={[0.7, -3.9, 8.2]} rotation={[Math.PI, 0, 0]} material={iron}>
          <coneGeometry args={[0.28, 1.1, 4]} />
        </mesh>
        <mesh position={[-0.35, -2.7, 8.2]} rotation={[0, 0, Math.PI / 2]} material={iron}>
          <coneGeometry args={[0.26, 1.05, 4]} />
        </mesh>
        <mesh position={[1.75, -2.7, 8.2]} rotation={[0, 0, -Math.PI / 2]} material={iron}>
          <coneGeometry args={[0.26, 1.05, 4]} />
        </mesh>
      </group>
    </group>
  );
}

function ArrowVolley({ big }: { big: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const g = devGiantAt(t);
    for (let i = 0; i < ARROWS; i++) {
      const phase = ((t * 0.8 + i * 0.19) % 1.4) / 1.4;
      const ang = (i / ARROWS) * Math.PI * 2;
      const rad = (big ? 32 : 22) + (i % 4) * 1.6;
      const sx = g.x + Math.sin(ang) * rad;
      const sz = g.z + Math.cos(ang) * rad;
      const u = phase;
      const aimY = big ? 14 : 9.2;
      dummy.position.set(sx + (g.x - sx) * u, 1.6 + (aimY - 1.6) * u + Math.sin(u * Math.PI) * 2.6, sz + (g.z - sz) * u);
      dummy.lookAt(g.x, aimY, g.z);
      dummy.rotateX(Math.PI / 2);
      const show = t > 2 && t < LAST_ARROW && u > 0.06 && u < 0.9;
      dummy.scale.set(show ? 0.56 : 0, show ? 1.15 : 0, show ? 0.56 : 0);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.count = ARROWS;
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, ARROWS]} frustumCulled={false}>
      <cylinderGeometry args={[0.04, 0.015, 1.35, 5]} />
      <meshStandardMaterial color="#d7c39a" roughness={0.55} />
    </instancedMesh>
  );
}

const LAST_ARROW = 52.2;

export function Giant({ soldiers, big = false, sword = false }: { soldiers: number; big?: boolean; sword?: boolean }) {
  return (
    <group>
      <GiantBody soldiers={soldiers} big={big} sword={sword} />
      <ArrowVolley big={big} />
    </group>
  );
}

export function DevHealthBar({ soldiers, big = false, sword = false }: { soldiers: number; big?: boolean; sword?: boolean }) {
  return (
    <Hud renderPriority={3}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <DevHealthPlate soldiers={soldiers} big={big} sword={sword} />
    </Hud>
  );
}

function DevHealthPlate({ soldiers, big, sword }: { soldiers: number; big: boolean; sword: boolean }) {
  const size = useThree((s) => s.size);
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 180;
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);
  useFrame(({ clock }) => {
    const alive = devAlive(Math.max(0, clock.elapsedTime - REEL_HOLD), soldiers, big, sword);
    const canvas = tex.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 1024, 180);
    const innerX = 28;
    const innerY = 46;
    const innerW = 968;
    const innerH = 92;
    const fill = (alive / Math.max(1, soldiers)) * innerW;
    ctx.fillStyle = "#3a1212";
    ctx.fillRect(innerX, innerY, innerW, innerH);
    ctx.fillStyle = "#1d6bff";
    ctx.fillRect(innerX, innerY, Math.max(0, fill), innerH);
    ctx.strokeStyle = "#ffe14a";
    ctx.lineWidth = 16;
    ctx.strokeRect(innerX - 8, innerY - 8, innerW + 16, innerH + 16);
    ctx.font = "900 58px Inter, sans-serif";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0,0,0,0.72)";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.strokeText(formatCount(alive), 48, innerY + innerH / 2);
    ctx.fillText(formatCount(alive), 48, innerY + innerH / 2);
    ctx.font = "900 40px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 6;
    ctx.strokeText("ASKER", 512, innerY + innerH / 2);
    ctx.fillText("ASKER", 512, innerY + innerH / 2);
    tex.needsUpdate = true;
  });
  const w = size.width * 0.92;
  const h = w * (180 / 1024);
  return (
    <mesh position={[0, size.height / 2 - h * 0.55 - 18, 4]} renderOrder={30}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
    </mesh>
  );
}
