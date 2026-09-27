import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { REEL_HOLD } from "../../recordCanvas";
import { LAB_DRAGON, LAB_FOES, LAB_WALLS, labDragonFall, labFoeAt } from "../../mazeReel";
import type { New1Pose } from "../../new1Reel";
import { getSwordRaiderGeometry } from "./SallyRaid";

const dummy = new THREE.Object3D();
const scratch: New1Pose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1 };

function wallBoxes() {
  const half = 2.2;
  const thick = 0.92;
  const boxes: { x: number; y: number; z: number; w: number; h: number; d: number; ry: number; tone: string }[] = [];
  const tones = ["#c4b5a2", "#b3a38e", "#d2c2ab", "#a89884"];
  LAB_WALLS.forEach(([x1, z1, x2, z2], n) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz) || 1;
    const ry = Math.atan2(dx, dz);
    const px = Math.cos(ry);
    const pz = -Math.sin(ry);
    const mx = (x1 + x2) / 2;
    const mz = (z1 + z2) / 2;
    const span = len + 2.4;
    const h = 3.15;
    for (const side of [-1, 1]) {
      boxes.push({
        x: mx + px * half * side,
        y: h / 2,
        z: mz + pz * half * side,
        w: thick,
        h,
        d: span,
        ry,
        tone: tones[(n + (side > 0 ? 1 : 0)) % tones.length],
      });
    }
  });
  return boxes;
}

function Dragon() {
  const ref = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Mesh>(null);
  const wingR = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const fall = labDragonFall(clock.elapsedTime - REEL_HOLD);
    if (!ref.current) return;
    ref.current.visible = !fall.gone;
    ref.current.position.set(LAB_DRAGON.x, fall.u * 0.15, LAB_DRAGON.z);
    ref.current.rotation.set(fall.u * 1.35, Math.PI, 0);
    const flap = Math.sin(fall.flap * 7) * (1 - fall.u) * 0.45;
    if (wingL.current) wingL.current.rotation.z = 0.5 + flap;
    if (wingR.current) wingR.current.rotation.z = -0.5 - flap;
  });
  const hide = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1d3a28", roughness: 0.55, metalness: 0.22 }), []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d7a441", roughness: 0.4, metalness: 0.45 }), []);
  const wingMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#234833", roughness: 0.7, metalness: 0.08, side: THREE.DoubleSide }), []);
  return (
    <group ref={ref} position={[LAB_DRAGON.x, 0, LAB_DRAGON.z]}>
      <mesh position={[0, 1.15, 0]} material={hide} castShadow>
        <boxGeometry args={[1.5, 1.15, 3.4]} />
      </mesh>
      <mesh position={[0, 1.55, 1.7]} material={hide}>
        <boxGeometry args={[0.7, 0.7, 1.5]} />
      </mesh>
      <mesh position={[0, 1.7, 2.55]} material={gold}>
        <boxGeometry args={[0.95, 0.72, 1.15]} />
      </mesh>
      <mesh position={[-0.28, 2.15, 2.7]} material={gold}>
        <coneGeometry args={[0.12, 0.55, 5]} />
      </mesh>
      <mesh position={[0.28, 2.15, 2.7]} material={gold}>
        <coneGeometry args={[0.12, 0.55, 5]} />
      </mesh>
      <mesh position={[0, 0.7, -2.3]} rotation={[0.4, 0, 0]} material={hide}>
        <boxGeometry args={[0.45, 0.4, 2.2]} />
      </mesh>
      <mesh ref={wingL} position={[-1.15, 1.7, 0.2]} material={wingMat}>
        <boxGeometry args={[2.6, 0.08, 1.5]} />
      </mesh>
      <mesh ref={wingR} position={[1.15, 1.7, 0.2]} material={wingMat}>
        <boxGeometry args={[2.6, 0.08, 1.5]} />
      </mesh>
    </group>
  );
}

function Foes() {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => getSwordRaiderGeometry(), []);
  useFrame(({ clock }) => {
    if (!bodies.current) return;
    const recT = clock.elapsedTime - REEL_HOLD;
    for (let i = 0; i < LAB_FOES; i++) {
      labFoeAt(i, recT, scratch);
      dummy.position.set(scratch.x, scratch.y, scratch.z);
      dummy.rotation.set(scratch.rx, scratch.ry, scratch.rz);
      dummy.scale.setScalar((scratch.s ?? 1) > 0 ? 1.2 : 0);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(i, dummy.matrix);
    }
    bodies.current.count = LAB_FOES;
    bodies.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={bodies} args={[geo, undefined, LAB_FOES]} frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={0.52} metalness={0.14} />
    </instancedMesh>
  );
}

export function Maze() {
  const boxes = useMemo(() => wallBoxes(), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, -0.08, 48]}>
        <planeGeometry args={[90, 130]} />
        <meshStandardMaterial color="#6d6458" roughness={0.94} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, 0.02, 48]}>
        <planeGeometry args={[70, 110]} />
        <meshStandardMaterial color="#8b7358" roughness={0.86} />
      </mesh>
      {boxes.map((box, i) => (
        <mesh key={i} position={[box.x, box.y, box.z]} rotation={[0, box.ry, 0]}>
          <boxGeometry args={[box.w, box.h, box.d]} />
          <meshStandardMaterial color={box.tone} roughness={0.88} metalness={0.04} />
        </mesh>
      ))}
      <ambientLight intensity={0.72} color="#fff6ea" />
      <directionalLight position={[24, 48, 18]} intensity={1.85} color="#fff8ee" />
      <hemisphereLight args={["#fff4e2", "#6d6256", 0.85]} />
      <pointLight position={[0, 6, 8]} intensity={30} distance={28} color="#ffd19a" />
      <pointLight position={[13, 6, 28]} intensity={26} distance={26} color="#ffd19a" />
      <pointLight position={[1, 8, 52]} intensity={34} distance={30} color="#ffb088" />
      <pointLight position={[4, 6, 90]} intensity={28} distance={28} color="#fff0cc" />
      <Dragon />
      <Foes />
    </group>
  );
}
