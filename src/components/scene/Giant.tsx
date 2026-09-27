import { useMemo, useRef } from "react";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { formatCount } from "../../game";
import { REEL_HOLD } from "../../recordCanvas";
import { devAlive, devClubHit, devGiantAt } from "../../devReel";

const dummy = new THREE.Object3D();
const ARROWS = 36;

function GiantBody({ soldiers }: { soldiers: number }) {
  const root = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const club = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const g = devGiantAt(t);
    const hit = devClubHit(t, soldiers);
    if (root.current) {
      root.current.position.set(g.x, Math.abs(Math.sin(t * 2.4)) * 0.12, g.z);
      root.current.rotation.y = g.yaw;
    }
    if (arm.current) arm.current.rotation.z = -0.15 - hit * 0.35;
    if (club.current) club.current.rotation.x = -0.35 - hit * 1.65;
  });
  return (
    <group ref={root}>
      <mesh position={[-0.85, 2.3, 0]}>
        <cylinderGeometry args={[0.62, 0.78, 3.6, 8]} />
        <meshStandardMaterial color="#7d6a58" roughness={0.84} />
      </mesh>
      <mesh position={[0.85, 2.3, 0]}>
        <cylinderGeometry args={[0.62, 0.78, 3.6, 8]} />
        <meshStandardMaterial color="#7d6a58" roughness={0.84} />
      </mesh>
      <mesh position={[0, 4.55, 0]}>
        <boxGeometry args={[3.5, 1.15, 2.1]} />
        <meshStandardMaterial color="#3d2c22" roughness={0.9} />
      </mesh>
      <mesh position={[0, 6.55, 0]}>
        <boxGeometry args={[3.9, 3.3, 2.15]} />
        <meshStandardMaterial color="#8d7562" roughness={0.78} />
      </mesh>
      <mesh position={[0, 8.55, 0.15]}>
        <boxGeometry args={[2.5, 1.7, 1.7]} />
        <meshStandardMaterial color="#947b66" roughness={0.74} />
      </mesh>
      <mesh position={[-0.48, 8.7, 0.95]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#1a120e" roughness={0.4} />
      </mesh>
      <mesh position={[0.48, 8.7, 0.95]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#1a120e" roughness={0.4} />
      </mesh>
      <group ref={arm} position={[-2.15, 7.5, 0.15]}>
        <mesh position={[-0.15, -1.25, 0.15]} rotation={[0.25, 0, 0.2]}>
          <cylinderGeometry args={[0.42, 0.5, 2.3, 7]} />
          <meshStandardMaterial color="#8d7562" roughness={0.8} />
        </mesh>
      </group>
      <group ref={club} position={[2.15, 7.55, 0.2]}>
        <mesh position={[0.2, -1.15, 0.35]} rotation={[0.45, 0, -0.15]}>
          <cylinderGeometry args={[0.48, 0.58, 2.5, 7]} />
          <meshStandardMaterial color="#8d7562" roughness={0.8} />
        </mesh>
        <mesh position={[0.55, -1.7, 3.15]} rotation={[1.25, 0.1, 0]}>
          <cylinderGeometry args={[0.34, 0.72, 6.8, 8]} />
          <meshStandardMaterial color="#6a5038" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

function ArrowVolley() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const g = devGiantAt(t);
    for (let i = 0; i < ARROWS; i++) {
      const phase = ((t * 0.8 + i * 0.19) % 1.4) / 1.4;
      const ang = (i / ARROWS) * Math.PI * 2;
      const rad = 17 + (i % 5) * 1.4;
      const sx = g.x + Math.sin(ang) * rad;
      const sz = g.z + Math.cos(ang) * rad;
      const u = phase;
      dummy.position.set(sx + (g.x - sx) * u, 1.5 + (6.4 - 1.5) * u + Math.sin(u * Math.PI) * 2.4, sz + (g.z - sz) * u);
      dummy.lookAt(g.x, 6.2, g.z);
      dummy.rotateX(Math.PI / 2);
      const show = t > 2 && t < LAST_ARROW && u > 0.06 && u < 0.9;
      dummy.scale.set(show ? 0.28 : 0, show ? 1.15 : 0, show ? 0.28 : 0);
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

export function Giant({ soldiers }: { soldiers: number }) {
  return (
    <group>
      <GiantBody soldiers={soldiers} />
      <ArrowVolley />
    </group>
  );
}

export function DevHealthBar({ soldiers }: { soldiers: number }) {
  return (
    <Hud renderPriority={3}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <DevHealthPlate soldiers={soldiers} />
    </Hud>
  );
}

function DevHealthPlate({ soldiers }: { soldiers: number }) {
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
    const alive = devAlive(Math.max(0, clock.elapsedTime - REEL_HOLD), soldiers);
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
