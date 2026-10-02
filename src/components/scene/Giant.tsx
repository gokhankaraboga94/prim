import { useMemo, useRef } from "react";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { formatCount } from "../../game";
import { REEL_HOLD } from "../../recordCanvas";
import { devAlive, devClubHit, devGiantAt, devMaceSwing, devSwordPose } from "../../devReel";

const dummy = new THREE.Object3D();
const ARROWS = 18;

function DreadShell({ plate, iron, eye, horn }: { plate: THREE.Material; iron: THREE.Material; eye: THREE.Material; horn: THREE.Material }) {
  return (
    <group>
      <mesh position={[-1.05, 2.4, 0.15]} rotation={[0.1, 0, 0.1]} material={plate}>
        <cylinderGeometry args={[0.78, 1.05, 4.2, 6]} />
      </mesh>
      <mesh position={[1.15, 2.4, 0.05]} rotation={[0.08, 0, -0.12]} material={plate}>
        <cylinderGeometry args={[0.82, 1.08, 4.3, 6]} />
      </mesh>
      <mesh position={[-1.2, 0.42, 0.55]} rotation={[0.2, 0.1, 0]} material={iron}>
        <boxGeometry args={[1.25, 0.5, 1.9]} />
      </mesh>
      <mesh position={[1.3, 0.38, 0.42]} rotation={[0.15, -0.15, 0]} material={iron}>
        <boxGeometry args={[1.35, 0.54, 2.05]} />
      </mesh>
      {[-0.35, 0.05, 0.42].map((x) => (
        <mesh key={`l${x}`} position={[-1.15 + x, 0.22, 1.35]} rotation={[1.15, 0, 0.2]} material={horn}>
          <coneGeometry args={[0.1, 0.55, 4]} />
        </mesh>
      ))}
      {[-0.28, 0.12, 0.48].map((x) => (
        <mesh key={`r${x}`} position={[1.2 + x, 0.2, 1.28]} rotation={[1.15, 0, -0.15]} material={horn}>
          <coneGeometry args={[0.11, 0.62, 4]} />
        </mesh>
      ))}
      <mesh position={[0, 5.7, 0.1]} material={plate}>
        <boxGeometry args={[3.6, 1.7, 2.15]} />
      </mesh>
      <mesh position={[0.1, 8.35, 0.42]} rotation={[0.22, 0, 0]} material={plate}>
        <boxGeometry args={[4.7, 4.15, 2.7]} />
      </mesh>
      <mesh position={[-0.2, 9.05, 1.35]} rotation={[0.38, 0.04, 0.06]} material={iron}>
        <boxGeometry args={[3.3, 2.5, 0.38]} />
      </mesh>
      <mesh position={[1.15, 7.7, 1.25]} rotation={[0.45, -0.15, -0.1]} material={iron}>
        <boxGeometry args={[1.7, 1.45, 0.32]} />
      </mesh>
      <mesh position={[-1.7, 8.6, 0.2]} rotation={[0, 0, 0.35]} material={plate}>
        <boxGeometry args={[1.1, 2.2, 1.3]} />
      </mesh>
      <mesh position={[1.85, 8.55, 0.15]} rotation={[0, 0, -0.32]} material={plate}>
        <boxGeometry args={[1.15, 2.3, 1.35]} />
      </mesh>
      <mesh position={[0, 10.7, -0.05]} material={iron}>
        <boxGeometry args={[5.8, 1.05, 2.05]} />
      </mesh>
      <mesh position={[-2.55, 11.05, 0.15]} rotation={[0.12, 0, 0.28]} material={plate}>
        <boxGeometry args={[2.05, 1.05, 2.25]} />
      </mesh>
      <mesh position={[2.7, 11.15, 0.05]} rotation={[-0.08, 0, -0.26]} material={plate}>
        <boxGeometry args={[2.25, 1.15, 2.4]} />
      </mesh>
      <mesh position={[-3.15, 11.55, 0.15]} rotation={[0.2, 0, 0.7]} material={horn}>
        <coneGeometry args={[0.22, 1.25, 4]} />
      </mesh>
      <mesh position={[3.35, 11.85, 0.2]} rotation={[0.35, 0.2, -0.85]} material={horn}>
        <coneGeometry args={[0.26, 1.55, 4]} />
      </mesh>
      <mesh position={[2.7, 11.15, 0.85]} rotation={[0.8, 0, -0.2]} material={horn}>
        <coneGeometry args={[0.14, 0.7, 4]} />
      </mesh>
      {[-0.55, 0.05, 0.65, 1.25].map((y, i) => (
        <mesh key={y} position={[(i - 1.5) * 0.18, 7.1 + y, -1.05]} rotation={[-0.7, 0, 0]} material={horn}>
          <coneGeometry args={[0.16, 0.85, 4]} />
        </mesh>
      ))}
      <mesh position={[0, 12.45, 0.05]} material={plate}>
        <cylinderGeometry args={[0.72, 1.05, 1.2, 6]} />
      </mesh>
      <mesh position={[0.05, 13.85, 0.15]} rotation={[0.18, 0, 0]} material={plate}>
        <cylinderGeometry args={[0.95, 1.25, 2.35, 7]} />
      </mesh>
      <mesh position={[0.05, 15.15, 0.05]} material={iron}>
        <cylinderGeometry args={[0.22, 0.85, 0.85, 6]} />
      </mesh>
      <mesh position={[-0.85, 14.7, 0.15]} rotation={[0.35, 0, 0.85]} material={horn}>
        <coneGeometry args={[0.22, 2.15, 5]} />
      </mesh>
      <mesh position={[0.95, 14.85, 0.25]} rotation={[0.45, 0, -0.95]} material={horn}>
        <coneGeometry args={[0.24, 2.45, 5]} />
      </mesh>
      <mesh position={[0.08, 13.55, 1.28]} material={eye}>
        <boxGeometry args={[1.45, 0.16, 0.1]} />
      </mesh>
      <mesh position={[0.08, 12.95, 1.22]} material={iron}>
        <boxGeometry args={[0.85, 0.22, 0.12]} />
      </mesh>
    </group>
  );
}

function GiantBody({ soldiers, big, sword, dread }: { soldiers: number; big: boolean; sword: boolean; dread: boolean }) {
  const root = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const mace = useRef<THREE.Group>(null);
  const blade = useRef<THREE.Group>(null);
  const plate = useMemo(() => new THREE.MeshStandardMaterial({ color: "#121216", metalness: 0.78, roughness: 0.32 }), []);
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a2a30", metalness: 0.7, roughness: 0.4 }), []);
  const slit = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ff2a14", emissive: "#ff1a10", emissiveIntensity: 1.4, roughness: 0.4 }), []);
  const eye = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ff3a18", emissive: "#ff1a08", emissiveIntensity: 2.4, roughness: 0.28 }), []);
  const horn = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a1816", metalness: 0.45, roughness: 0.55 }), []);
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
      {dread ? (
        <DreadShell plate={plate} iron={iron} eye={eye} horn={horn} />
      ) : (
        <>
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
        </>
      )}
      <group ref={arm} position={[-2.7, 10.4, 0.2]}>
        {dread ? (
          <>
            <mesh position={[-0.18, -0.95, 0.12]} rotation={[0.12, 0, 0.08]} material={plate}>
              <cylinderGeometry args={[0.62, 0.82, 1.95, 6]} />
            </mesh>
            <mesh position={[-0.34, -2.4, 0.32]} rotation={[0.28, 0, 0.06]} material={iron}>
              <cylinderGeometry args={[0.5, 0.66, 1.8, 5]} />
            </mesh>
            <mesh position={[-0.22, -1.85, 0.55]} rotation={[0.4, 0, 0.6]} material={horn}>
              <coneGeometry args={[0.12, 0.55, 4]} />
            </mesh>
          </>
        ) : (
          <mesh position={[-0.25, -1.7, 0.2]} rotation={[0.2, 0, 0.15]} material={plate}>
            <cylinderGeometry args={[0.42, 0.55, 3.2, 6]} />
          </mesh>
        )}
        {sword && (
          <group ref={blade} position={[-0.4, -3.25, 0.45]}>
            <mesh position={[0, 0, 0.28]} material={iron}>
              <boxGeometry args={[0.46, 0.46, 0.7]} />
            </mesh>
            <mesh position={[0, 0, 0.82]} material={plate}>
              <boxGeometry args={[1.7, 0.4, 0.42]} />
            </mesh>
            <mesh position={[0, 0, 4.45]} material={iron}>
              <boxGeometry args={[0.62, 0.32, 6.8]} />
            </mesh>
          </group>
        )}
      </group>
      <group ref={mace} position={[2.7, 10.5, 0.25]}>
        {dread ? (
          <>
            <mesh position={[0.22, -0.9, 0.18]} rotation={[0.2, 0, -0.08]} material={plate}>
              <cylinderGeometry args={[0.68, 0.86, 1.85, 6]} />
            </mesh>
            <mesh position={[0.38, -2.25, 0.42]} rotation={[0.42, 0, -0.06]} material={iron}>
              <cylinderGeometry args={[0.52, 0.68, 1.7, 5]} />
            </mesh>
          </>
        ) : (
          <mesh position={[0.25, -1.5, 0.55]} rotation={[0.55, 0, -0.1]} material={plate}>
            <cylinderGeometry args={[0.48, 0.62, 3.1, 6]} />
          </mesh>
        )}
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

const SNAKE_SEGS = 14;

function SnakeBody({ soldiers }: { soldiers: number }) {
  const root = useRef<THREE.Group>(null);
  const parts = useRef<(THREE.Group | null)[]>([]);
  const jaw = useRef<THREE.Group>(null);
  const hide = useMemo(() => new THREE.MeshStandardMaterial({ color: "#070708", roughness: 0.78, metalness: 0.22 }), []);
  const belly = useMemo(() => new THREE.MeshStandardMaterial({ color: "#16161a", roughness: 0.86, metalness: 0.06 }), []);
  const mouth = useMemo(() => new THREE.MeshStandardMaterial({ color: "#4a1010", roughness: 0.5, metalness: 0.05 }), []);
  const fang = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e6e0d6", roughness: 0.32, metalness: 0.18 }), []);
  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const g = devGiantAt(t);
    const s = devMaceSwing(t, soldiers);
    const slash = devSwordPose(t);
    const bite = Math.max(0, s.lunge, Math.min(1, Math.max(0, slash.armX - 0.15) / 0.95));
    const fx = Math.sin(g.yaw);
    const fz = Math.cos(g.yaw);
    if (root.current) {
      root.current.position.set(g.x + fx * bite * 1.8, 0, g.z + fz * bite * 1.8);
      root.current.rotation.y = g.yaw + s.twist * 0.35;
    }
    for (let i = 0; i < SNAKE_SEGS; i++) {
      const node = parts.current[i];
      if (!node) continue;
      const u = i / (SNAKE_SEGS - 1);
      const head = i < 2;
      const wave = Math.sin(t * 2.4 - i * 0.62);
      const coil = Math.sin(u * Math.PI * 2.4 + t * 0.7);
      node.position.set(
        coil * (1.6 + u * 2.4) + wave * 0.28,
        1.15 + Math.sin(u * Math.PI) * 5.6 + (head ? 1.4 + bite * 2.2 : 0) + wave * 0.12,
        7.2 - u * 18 + (head ? bite * 4.4 : 0)
      );
      node.scale.setScalar(head ? 1.55 - i * 0.12 : Math.max(0.38, 1.28 * (1 - u * 0.78)));
      node.rotation.y = coil * 0.35;
    }
    if (jaw.current) jaw.current.rotation.x = 0.12 + bite * 1.05;
  });
  return (
    <group ref={root} scale={1.52}>
      {Array.from({ length: SNAKE_SEGS }, (_, i) => (
        <group key={i} ref={(el) => { parts.current[i] = el; }}>
          <mesh material={hide}>
            <sphereGeometry args={[1, i < 2 ? 8 : 6, i < 2 ? 6 : 5]} />
          </mesh>
          <mesh position={[0, -0.32, 0]} scale={[0.7, 0.42, 0.82]} material={belly}>
            <sphereGeometry args={[1, 6, 4]} />
          </mesh>
          {i === 0 && (
            <>
              <mesh position={[0, 0.08, 0.85]} material={hide}>
                <boxGeometry args={[0.85, 0.42, 0.7]} />
              </mesh>
              <mesh position={[0, -0.02, 0.72]} material={mouth}>
                <boxGeometry args={[0.55, 0.16, 0.42]} />
              </mesh>
              <group ref={jaw} position={[0, -0.18, 0.55]}>
                <mesh position={[0, -0.12, 0.38]} material={hide}>
                  <boxGeometry args={[0.72, 0.22, 0.78]} />
                </mesh>
                <mesh position={[-0.18, -0.02, 0.62]} rotation={[1.15, 0, 0.15]} material={fang}>
                  <coneGeometry args={[0.06, 0.38, 4]} />
                </mesh>
                <mesh position={[0.18, -0.02, 0.62]} rotation={[1.15, 0, -0.15]} material={fang}>
                  <coneGeometry args={[0.06, 0.38, 4]} />
                </mesh>
              </group>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

export function Giant({ soldiers, big = false, sword = false, dread = false, snake = false }: { soldiers: number; big?: boolean; sword?: boolean; dread?: boolean; snake?: boolean }) {
  return (
    <group>
      {snake ? <SnakeBody soldiers={soldiers} /> : <GiantBody soldiers={soldiers} big={big} sword={sword} dread={dread} />}
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
