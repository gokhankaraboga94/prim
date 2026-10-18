import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { buildKnightSoldier } from "../../knightSoldier";
import { buildNameAtlas, type NameAtlas, type NameCell } from "../../nameAtlas";
import { REEL_HOLD } from "../../recordCanvas";
import {
  KALKAN_N,
  kalkanArrow,
  kalkanCam,
  kalkanCast,
  kalkanClean,
  kalkanFocus,
  kalkanHudOpen,
  kalkanLine,
  kalkanShield,
  kalkanSword,
  kalkanVictim,
  type KalkanPose,
} from "../../kalkanReel";

const dummy = new THREE.Object3D();
const up = new THREE.Vector3(0, 1, 0);
const dir = new THREE.Vector3();
const spin = new THREE.Quaternion();

function arrowGeo() {
  const shaft = new THREE.CylinderGeometry(0.02, 0.02, 0.52, 6);
  shaft.translate(0, 0.26, 0);
  const head = new THREE.ConeGeometry(0.055, 0.2, 6);
  head.translate(0, 0.62, 0);
  const geo = mergeGeometries([shaft, head], false);
  shaft.dispose();
  head.dispose();
  return geo;
}

function place(pose: KalkanPose | null) {
  dummy.rotation.order = "YXZ";
  if (!pose) {
    dummy.position.set(0, -30, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(0);
  } else {
    dummy.position.set(pose.x, pose.y, pose.z);
    dummy.rotation.set(pose.pitch, pose.yaw, pose.roll);
    dummy.scale.setScalar(pose.scale);
  }
  dummy.updateMatrix();
}

function headOf(pose: KalkanPose) {
  const c = Math.cos(pose.pitch);
  const s = Math.sin(pose.pitch);
  return {
    x: pose.x,
    y: 1.68 * c + 0.28,
    z: pose.z + 1.68 * s,
  };
}

export function KalkanCam() {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera, clock }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = kalkanCam(Math.max(0, clock.elapsedTime - REEL_HOLD));
    persp.fov = shot.fov;
    persp.near = 0.2;
    persp.far = 160;
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

function paintPlate(canvas: HTMLCanvasElement, name: string, line: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.roundRect(36, 28, w - 72, h - 56, 42);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 300;
  const family = "Arial, sans-serif";
  ctx.font = `900 ${size}px ${family}`;
  while (ctx.measureText(name).width > w - 140 && size > 72) {
    size -= 6;
    ctx.font = `900 ${size}px ${family}`;
  }
  ctx.fillStyle = "#fff6d4";
  ctx.fillText(name, w / 2, h * 0.4);
  const threat = line.startsWith("bunu");
  ctx.font = threat ? "800 78px Arial, sans-serif" : "900 120px Arial, sans-serif";
  ctx.fillStyle = threat ? "#ffffff" : "#ff3b30";
  ctx.fillText(line, w / 2, h * 0.74);
}

function KalkanHud({ names }: { names: string[] }) {
  const size = useThree((s) => s.size);
  const plate = useRef<THREE.Mesh>(null);
  const shown = useRef("");
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 640;
    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame(({ clock }) => {
    const mesh = plate.current;
    if (!mesh) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const name = kalkanFocus(t, names);
    const line = kalkanLine(t);
    const key = `${name}|${line}`;
    if (shown.current !== key) {
      shown.current = key;
      paintPlate(tex.image as HTMLCanvasElement, name, line);
      tex.needsUpdate = true;
    }
    const open = kalkanHudOpen(t);
    const s = 0.56 + 0.44 * open;
    mesh.scale.setScalar(s);
    const h = size.height * 0.42;
    mesh.position.y = size.height / 2 - (h * s) / 2 - 12;
  });
  const w = size.width * 0.96;
  const h = size.height * 0.42;
  return (
    <Hud renderPriority={3}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh ref={plate} position={[0, size.height / 2 - h / 2 - 12, 4]} renderOrder={30}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
      </mesh>
    </Hud>
  );
}

function KalkanTags({ names }: { names: string[] }) {
  const labels = useMemo(() => {
    const out: { victim: boolean; slot: number }[] = [];
    if (kalkanClean(names[0] || "")) out.push({ victim: true, slot: 0 });
    for (let i = 0; i < KALKAN_N; i++) {
      if (kalkanClean(names[i + 1] || "")) out.push({ victim: false, slot: i });
    }
    return out;
  }, [names]);
  const atlas = useMemo<NameAtlas | null>(() => {
    if (!labels.length) return null;
    const items = labels.map((n) => ({
      text: kalkanClean(names[n.victim ? 0 : n.slot + 1] || ""),
      commander: false,
      plain: true,
      fill: "#ffe14a",
      frame: true,
    }));
    try {
      return buildNameAtlas(items, true);
    } catch {
      return buildNameAtlas(items);
    }
  }, [labels, names]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const { camera } = useThree();
  useEffect(() => () => atlas?.dispose(), [atlas]);
  useFrame(({ clock }) => {
    if (!atlas) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    dummy.quaternion.copy(camera.quaternion);
    for (let k = 0; k < labels.length; k++) {
      const cell: NameCell | undefined = atlas.cells[k];
      const mesh = cell ? refs.current[cell.sheet] : null;
      if (!cell || !mesh) continue;
      const label = labels[k];
      const pose = label.victim ? kalkanVictim() : kalkanShield(label.slot, t);
      if (!pose) {
        dummy.position.set(0, -30, 0);
        dummy.scale.set(0, 0, 1);
      } else {
        const head = headOf(pose);
        const width = 0.6;
        const size = width / Math.max(1.15, cell.sx);
        dummy.position.set(head.x, head.y, head.z);
        dummy.scale.set(cell.sx * size, cell.sy * size, 1);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(cell.local, dummy.matrix);
    }
    for (const mesh of refs.current) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });
  if (!atlas) return null;
  return (
    <group>
      {atlas.sheets.map((sheet, s) =>
        sheet.count > 0 ? (
          <instancedMesh
            key={s}
            ref={(node) => {
              refs.current[s] = node;
            }}
            args={[sheet.geometry, sheet.material, sheet.count]}
            frustumCulled={false}
            renderOrder={12}
          />
        ) : null
      )}
    </group>
  );
}

function KalkanFighters() {
  const [knight, setKnight] = useState<{ body: THREE.BufferGeometry; helm: THREE.BufferGeometry } | null>(null);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const helmRef = useRef<THREE.InstancedMesh>(null);
  const arrowRef = useRef<THREE.Mesh>(null);
  const swordRef = useRef<THREE.Group>(null);
  const knightRef = useRef<{ body: THREE.BufferGeometry; helm: THREE.BufferGeometry } | null>(null);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a56e8", roughness: 0.42, metalness: 0.38 }), []);
  const helmMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e7eef5", roughness: 0.18, metalness: 0.9 }), []);
  const arrowMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f3d48a", roughness: 0.4, metalness: 0.2, emissive: "#6a4a16", emissiveIntensity: 0.35 }), []);
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e7eef6", metalness: 0.92, roughness: 0.16, emissive: "#b7c6d6", emissiveIntensity: 0.35 }), []);
  const arrows = useMemo(() => arrowGeo(), []);

  useEffect(() => {
    let drop = false;
    const loader = new GLTFLoader();
    loader.load("/models/knight.glb", (gltf) => {
      if (drop) return;
      const built = buildKnightSoldier(gltf.scene);
      knightRef.current = built;
      setKnight(built);
    });
    return () => {
      drop = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      bodyMat.dispose();
      helmMat.dispose();
      arrowMat.dispose();
      steel.dispose();
      arrows?.dispose();
      knightRef.current?.body.dispose();
      knightRef.current?.helm.dispose();
    };
  }, [bodyMat, helmMat, arrowMat, steel, arrows]);

  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const body = bodyRef.current;
    const helm = helmRef.current;
    if (body && helm) {
      place(kalkanVictim());
      body.setMatrixAt(0, dummy.matrix);
      helm.setMatrixAt(0, dummy.matrix);
      for (let i = 0; i < KALKAN_N; i++) {
        place(kalkanShield(i, t));
        body.setMatrixAt(i + 1, dummy.matrix);
        helm.setMatrixAt(i + 1, dummy.matrix);
      }
      body.instanceMatrix.needsUpdate = true;
      helm.instanceMatrix.needsUpdate = true;
    }
    const arrow = arrowRef.current;
    if (arrow) {
      const shot = kalkanArrow(t);
      dir.set(shot.dx, shot.dy, shot.dz);
      if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
      else dir.normalize();
      arrow.position.set(shot.x, shot.y, shot.z);
      spin.setFromUnitVectors(up, dir);
      arrow.quaternion.copy(spin);
    }
    const sword = swordRef.current;
    if (sword) {
      const blade = kalkanSword(t);
      sword.visible = blade.show;
      sword.position.set(blade.x, blade.y, blade.z);
      sword.scale.setScalar(1.85);
      sword.rotation.order = "YXZ";
      sword.rotation.set(blade.pitch, blade.yaw, 0);
    }
  });

  return (
    <group>
      {knight && (
        <>
          <instancedMesh ref={bodyRef} args={[knight.body, bodyMat, KALKAN_N + 1]} frustumCulled={false} />
          <instancedMesh ref={helmRef} args={[knight.helm, helmMat, KALKAN_N + 1]} frustumCulled={false} />
        </>
      )}
      {arrows && (
        <mesh ref={arrowRef} geometry={arrows} material={arrowMat} frustumCulled={false} />
      )}
      <group ref={swordRef} visible={false}>
        <mesh position={[0, 0.18, 0]} rotation={[Math.PI, 0, 0]} material={steel}>
          <coneGeometry args={[0.14, 0.36, 4]} />
        </mesh>
        <mesh position={[0, 2.35, 0]} material={steel}>
          <boxGeometry args={[0.18, 4.15, 0.05]} />
        </mesh>
        <mesh position={[0, 4.5, 0]} material={steel}>
          <boxGeometry args={[1.05, 0.1, 0.14]} />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0.6]}>
        <circleGeometry args={[11, 40]} />
        <meshStandardMaterial color="#101218" roughness={1} metalness={0} />
      </mesh>
      <ambientLight intensity={0.45} />
      <directionalLight position={[0.8, 2.4, 3.2]} intensity={2.8} color="#fff4e4" />
      <directionalLight position={[-1.6, 1.8, -0.8]} intensity={1.1} color="#8ea6ff" />
    </group>
  );
}

export function KalkanBattle({ names }: { names: string[] }) {
  const [cast] = useState(() => kalkanCast(names));
  return (
    <group>
      <KalkanFighters />
      <KalkanTags names={cast} />
      <KalkanHud names={cast} />
    </group>
  );
}
