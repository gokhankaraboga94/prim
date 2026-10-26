import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { fitHero } from "./ArenaBattle";
import {
  KURTAR_ALLIES,
  KURTAR_CAGE_Z,
  KURTAR_ELF,
  KURTAR_ELF_Z,
  KURTAR_FACE,
  KURTAR_LEAD,
  KURTAR_ORCS,
  KURTAR_ORC_A,
  KURTAR_ORC_B,
  kurtarAllyPose,
  kurtarBars,
  kurtarCam,
  kurtarCard,
  kurtarChip,
  kurtarHold,
  kurtarHp,
  kurtarLead,
  kurtarMarkReady,
  kurtarOrcPose,
  kurtarReset,
  kurtarT,
} from "../../kurtarReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

function loadGlb(loader: GLTFLoader, url: string) {
  const buf = preloadedGlb(url);
  return new Promise<Gltf>((ok, fail) => {
    if (buf) loader.parse(buf.slice(0), "", ok, fail);
    else loader.load(url, ok, undefined, fail);
  });
}

function armsOf(root: THREE.Object3D) {
  const list: THREE.Vector2[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.userData.armStrike) list.push(mesh.userData.armStrike as THREE.Vector2);
  });
  return list;
}

function setForm(root: THREE.Object3D, form: number) {
  root.traverse((obj) => {
    const slot = obj.userData.form as { value: number } | undefined;
    if (slot) slot.value = form;
  });
}

function stepGait(root: THREE.Object3D, moving: boolean, speed: number, delta: number) {
  root.traverse((obj) => {
    const gait = obj.userData.gait as THREE.Vector2 | undefined;
    if (!gait) return;
    const target = moving ? Math.min(1, speed / 2.4) : 0;
    gait.y += (target - gait.y) * Math.min(1, delta * 9);
    gait.x += Math.max(0, speed) * 3.4 * delta;
  });
}

/** Sword on +X is the figure's left. Mirror about the chest so it hangs in the right hand. */
function mirrorSwordToRight(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) meshes.push(mesh);
  });
  let minY = Infinity;
  let maxY = -Infinity;
  for (const mesh of meshes) {
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const height = Math.max(0.001, maxY - minY);
  const chest: number[] = [];
  for (const mesh of meshes) {
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const yn = (pos.getY(i) - minY) / height;
      if (yn > 0.5 && yn < 0.72) chest.push(pos.getX(i));
    }
  }
  if (chest.length < 30) return;
  chest.sort((a, b) => a - b);
  const cx = chest[chest.length >> 1];
  let tipX = cx;
  let tipD = -1;
  for (const mesh of meshes) {
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const yn = (pos.getY(i) - minY) / height;
      if (yn > 0.24) continue;
      const d = Math.abs(pos.getX(i) - cx);
      if (d <= tipD) continue;
      tipD = d;
      tipX = pos.getX(i);
    }
  }
  if (tipX <= cx) return;
  for (const mesh of meshes) {
    const geo = mesh.geometry;
    const pos = geo.getAttribute("position");
    const nrm = geo.getAttribute("normal");
    for (let i = 0; i < pos.count; i++) pos.setX(i, 2 * cx - pos.getX(i));
    pos.needsUpdate = true;
    if (nrm) {
      for (let i = 0; i < nrm.count; i++) nrm.setX(i, -nrm.getX(i));
      nrm.needsUpdate = true;
    }
    const idx = geo.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const b = idx.getX(i + 1);
        idx.setX(i + 1, idx.getX(i + 2));
        idx.setX(i + 2, b);
      }
      idx.needsUpdate = true;
    }
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
  }
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) mat?.dispose();
  });
}

function Block({
  args,
  position,
  color,
  rotation,
}: {
  args: [number, number, number];
  position: [number, number, number];
  color: string;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow={false} receiveShadow>
      <boxGeometry args={args} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

function Tunnel() {
  const ribs = [];
  for (let i = 0; i < 28; i++) {
    const z = i * 1.75 - 6;
    const open = z > 33 ? 1 : z > 28 ? 0.4 : 0;
    const half = 5.15 + open * 1.8;
    const h = 4.15 + open * 1.5;
    const stone = i % 2 === 0 ? "#8a7562" : "#746252";
    ribs.push(
      <Block key={`L${i}`} args={[0.9, h, 1.45]} position={[-half, h / 2, z]} color={stone} />,
      <Block key={`R${i}`} args={[0.9, h, 1.45]} position={[half, h / 2, z]} color={stone} />,
    );
    if (z < 16) ribs.push(<Block key={`C${i}`} args={[half * 2 + 0.9, 0.42, 1.45]} position={[0, h, z]} color="#6d5b4b" />);
  }
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 22]} receiveShadow>
        <planeGeometry args={[22, 64]} />
        <meshLambertMaterial color="#7a6754" />
      </mesh>
      <Block args={[10.4, 0.05, 58]} position={[0, 0.02, 22]} color="#8d7864" />
      {ribs}
      <Block args={[1.3, 3.2, 0.12]} position={[-3.6, 1.7, -1.2]} color="#a12830" />
      <Block args={[0.9, 2.1, 0.1]} position={[3.8, 2.0, 8.5]} color="#d26532" />
      <Block args={[1.1, 2.4, 0.1]} position={[-4.0, 1.8, 18.5]} color="#8e1e24" />
      <Torch position={[-4.15, 0, -0.6]} />
      <Torch position={[4.2, 0, 7.2]} />
      <Torch position={[-4.3, 0, 16.4]} />
      <Torch position={[4.35, 0, 26.2]} />
      <Flame position={[-4.4, 0, 34.2]} />
      <Flame position={[4.45, 0, 34.6]} />
    </group>
  );
}

function Torch({ position }: { position: [number, number, number] }) {
  const flame = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const f = 0.85 + Math.sin(clock.elapsedTime * 9 + position[2]) * 0.15;
    if (flame.current) flame.current.scale.y = f;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 1.5, 6]} />
        <meshLambertMaterial color="#2a2118" />
      </mesh>
      <mesh ref={flame} position={[0, 1.7, 0]}>
        <coneGeometry args={[0.14, 0.42, 6]} />
        <meshBasicMaterial color="#ff9a3a" />
      </mesh>
      <pointLight position={[0, 1.8, 0]} color="#ffb068" intensity={1.35} distance={8} decay={2} />
    </group>
  );
}

function Flame({ position }: { position: [number, number, number] }) {
  const flame = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const f = 0.85 + Math.sin(clock.elapsedTime * 9 + position[2]) * 0.15;
    if (flame.current) flame.current.scale.y = f;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 1.5, 6]} />
        <meshLambertMaterial color="#2a2118" />
      </mesh>
      <mesh ref={flame} position={[0, 1.7, 0]}>
        <coneGeometry args={[0.14, 0.42, 6]} />
        <meshBasicMaterial color="#ff9a3a" />
      </mesh>
    </group>
  );
}

function Cage() {
  const bars = useRef<THREE.Group>(null);
  useFrame(() => {
    const lift = kurtarBars(kurtarT());
    if (bars.current) bars.current.position.y = lift * 2.6;
  });
  const rods = [];
  for (let i = 0; i < 9; i++) rods.push(<mesh key={i} position={[-1.4 + i * 0.35, 1.2, 0]}><cylinderGeometry args={[0.05, 0.05, 2.45, 6]} /><meshLambertMaterial color="#2a2e34" /></mesh>);
  return (
    <group position={[0, 0, KURTAR_CAGE_Z]}>
      <Block args={[3.6, 0.16, 2.6]} position={[0, 0.08, 0.8]} color="#6a5a48" />
      <Block args={[12, 5.2, 0.45]} position={[0, 2.6, 2.6]} color="#5c5146" />
      <Block args={[12, 0.35, 2.6]} position={[0, 5.05, 2.1]} color="#4e453c" />
      <mesh position={[0, 1.35, 1.2]}>
        <sphereGeometry args={[0.7, 12, 10]} />
        <meshBasicMaterial color="#ffe0bf" transparent opacity={0.28} />
      </mesh>
      <pointLight position={[0, 2.4, 0.6]} color="#ffd0a0" intensity={3.2} distance={11} decay={2} />
      <group ref={bars}>{rods}</group>
      <Block args={[3.2, 0.16, 0.16]} position={[0, 2.48, 0]} color="#3a3e44" />
    </group>
  );
}

type Pack = {
  lead: THREE.Group;
  allies: THREE.Group[];
  elf: THREE.Group;
  orcs: THREE.Group[];
};

function Fighters({ pack }: { pack: Pack }) {
  const leadRef = useRef<THREE.Group>(null);
  const elfRef = useRef<THREE.Group>(null);
  const allyRefs = useRef<Array<THREE.Group | null>>([]);
  const orcRefs = useRef<Array<THREE.Group | null>>([]);
  const leadArms = useMemo(() => armsOf(pack.lead), [pack.lead]);
  const allyArms = useMemo(() => pack.allies.map(armsOf), [pack.allies]);
  const prevLead = useRef(0);
  const prevAlly = useRef<number[]>([0, 0, 0, 0]);
  useFrame((_, delta) => {
    const t = kurtarT();
    const dt = Math.min(0.05, delta);
    const lead = kurtarLead(t);
    const node = leadRef.current;
    if (node) {
      const speed = Math.abs(lead.z - prevLead.current) / Math.max(dt, 1e-4);
      prevLead.current = lead.z;
      node.position.set(lead.x, lead.y, lead.z);
      node.rotation.set(lead.kneel, lead.yaw + KURTAR_FACE, 0);
      for (const arm of leadArms) arm.set(lead.strike.lift, lead.strike.chop);
      setForm(pack.lead, lead.strike.form);
      const striking = lead.strike.chop > 0.35 || lead.strike.lift > 0.72 || lead.kneel > 0.12;
      stepGait(pack.lead, !striking && speed > 0.45, speed, dt);
    }
    KURTAR_ORCS.forEach((spec, i) => {
      const body = orcRefs.current[i];
      if (!body) return;
      const pose = kurtarOrcPose(spec, t);
      body.visible = pose.show;
      body.position.set(pose.x, 0, pose.z);
      const face = Math.atan2(-pose.x, lead.z - pose.z);
      body.rotation.set(pose.fall * 1.35, face + KURTAR_FACE, pose.fall * (i % 2 === 0 ? 0.22 : -0.22));
    });
    pack.allies.forEach((_, i) => {
      const body = allyRefs.current[i];
      if (!body) return;
      const pose = kurtarAllyPose(i, t);
      const prev = prevAlly.current[i] ?? pose.z;
      const runSpeed = Math.abs(pose.z - prev) / Math.max(dt, 1e-4);
      prevAlly.current[i] = pose.z;
      body.visible = pose.show;
      body.position.set(pose.x, pose.y, pose.z);
      body.rotation.set(0, pose.yaw + KURTAR_FACE, 0);
      const hit = pose.strike;
      for (const arm of allyArms[i]) arm.set(hit.lift, hit.chop);
      setForm(pack.allies[i], hit.form);
      const zooming = pose.yaw > 1;
      stepGait(pack.allies[i], pose.show && !zooming && hit.chop < 0.35 && runSpeed > 0.45, runSpeed, dt);
    });
    if (elfRef.current) {
      elfRef.current.position.set(0, 0, KURTAR_ELF_Z);
      elfRef.current.rotation.y = Math.PI + KURTAR_FACE;
    }
  });
  return (
    <group>
      <group ref={leadRef} scale={1.06}>
        <primitive object={pack.lead} />
      </group>
      {pack.allies.map((ally, i) => (
        <group key={KURTAR_ALLIES[i]} ref={(node) => { allyRefs.current[i] = node; }} scale={1.02} visible={false}>
          <primitive object={ally} />
        </group>
      ))}
      <group ref={elfRef}>
        <primitive object={pack.elf} />
      </group>
      {pack.orcs.map((orc, i) => (
        <group key={i} ref={(node) => { orcRefs.current[i] = node; }} visible={false}>
          <primitive object={orc} />
        </group>
      ))}
    </group>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function paintCard(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 980;
  canvas.height = 220;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  roundRect(ctx, 16, 14, 948, 192, 36);
  ctx.fillStyle = "#ffd54f";
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#111111";
  ctx.stroke();
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 92;
  ctx.font = `900 ${size}px Montserrat, Helvetica, Arial, sans-serif`;
  while (size > 48 && ctx.measureText(text).width > 820) {
    size -= 2;
    ctx.font = `900 ${size}px Montserrat, Helvetica, Arial, sans-serif`;
  }
  ctx.fillText(text, 490, 114);
  return canvas;
}

function paintHp(hp: number, chip: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, 640, 180);
  ctx.fillStyle = "#fff6ea";
  ctx.font = "900 42px Montserrat, Helvetica, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("CAN", 8, 36);
  ctx.fillText(String(hp), 150, 34);
  roundRect(ctx, 8, 70, 400, 42, 12);
  ctx.fillStyle = "#1a120c";
  ctx.fill();
  const w = Math.max(8, 384 * (hp / 100));
  roundRect(ctx, 16, 78, w, 26, 8);
  ctx.fillStyle = hp > 28 ? "#e23b4a" : "#ff2d2d";
  ctx.fill();
  if (chip) {
    ctx.fillStyle = "#ffd0d0";
    ctx.font = "900 40px Montserrat, Helvetica, Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(chip, 408, 34);
  }
  return canvas;
}

function KurtarHud() {
  const size = useThree((s) => s.size);
  const cardMat = useRef<THREE.MeshBasicMaterial>(null);
  const hpMat = useRef<THREE.MeshBasicMaterial>(null);
  const shown = useRef("");
  const hpKey = useRef("");
  const cards = useMemo(() => {
    const make = (text: string) => {
      const map = new THREE.CanvasTexture(paintCard(text));
      map.colorSpace = THREE.SRGBColorSpace;
      map.generateMipmaps = false;
      map.minFilter = THREE.LinearFilter;
      map.magFilter = THREE.LinearFilter;
      return map;
    };
    return { save: make("ONU KURTAR"), die: make("CANI BİTİYOR") };
  }, []);
  const hpMap = useMemo(() => {
    const map = new THREE.CanvasTexture(paintHp(100, ""));
    map.colorSpace = THREE.SRGBColorSpace;
    map.generateMipmaps = false;
    map.minFilter = THREE.LinearFilter;
    map.magFilter = THREE.LinearFilter;
    return map;
  }, []);
  useEffect(() => {
    document.fonts?.load("900 80px Montserrat").then(() => {
      for (const [text, map] of [["ONU KURTAR", cards.save], ["CANI BİTİYOR", cards.die]] as const) {
        const canvas = paintCard(text);
        map.image = canvas;
        map.needsUpdate = true;
      }
    }).catch(() => undefined);
  }, [cards]);
  useEffect(() => () => {
    cards.save.dispose();
    cards.die.dispose();
    hpMap.dispose();
  }, [cards, hpMap]);
  useFrame(() => {
    const t = kurtarT();
    const card = kurtarCard(t);
    const mat = cardMat.current;
    if (mat) {
      mat.opacity = card.opacity;
      const next = card.line === "CANI BİTİYOR" ? cards.die : cards.save;
      if (shown.current !== card.line && card.line) {
        shown.current = card.line;
        mat.map = next;
        mat.needsUpdate = true;
      }
    }
    const hp = kurtarHp(t);
    const chip = kurtarChip(t);
    const key = `${hp}:${chip ? chip.d : ""}`;
    if (hpKey.current !== key) {
      hpKey.current = key;
      const canvas = paintHp(hp, chip ? `-${chip.d}` : "");
      hpMap.image = canvas;
      hpMap.needsUpdate = true;
      if (hpMat.current) hpMat.current.opacity = 1;
    }
  });
  const cardW = size.width * 0.72;
  const cardH = cardW * (220 / 980);
  const hpW = size.width * 0.4;
  const hpH = hpW * (160 / 420);
  return (
    <Hud renderPriority={1}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh position={[0, size.height * 0.32, 5]} renderOrder={40}>
        <planeGeometry args={[cardW, cardH]} />
        <meshBasicMaterial ref={cardMat} map={cards.save} transparent depthTest={false} toneMapped={false} opacity={1} />
      </mesh>
      <mesh position={[-size.width * 0.26, size.height * 0.2, 5]} renderOrder={41}>
        <planeGeometry args={[hpW, hpH]} />
        <meshBasicMaterial ref={hpMat} map={hpMap} transparent depthTest={false} toneMapped={false} />
      </mesh>
    </Hud>
  );
}

export function KurtarCam() {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = kurtarCam(kurtarT());
    persp.fov = shot.fov;
    persp.near = 0.15;
    persp.far = 140;
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

export function KurtarBattle() {
  const [pack, setPack] = useState<Pack | null>(null);
  const keep = useRef<THREE.Object3D[]>([]);
  useEffect(() => {
    kurtarHold();
    let drop = false;
    const loader = new GLTFLoader();
    (async () => {
      try {
        const [leadG, a0, a1, a2, a3, elfG, orcA, orcB] = await Promise.all([
          loadGlb(loader, KURTAR_LEAD),
          loadGlb(loader, KURTAR_ALLIES[0]),
          loadGlb(loader, KURTAR_ALLIES[1]),
          loadGlb(loader, KURTAR_ALLIES[2]),
          loadGlb(loader, KURTAR_ALLIES[3]),
          loadGlb(loader, KURTAR_ELF),
          loadGlb(loader, KURTAR_ORC_A),
          loadGlb(loader, KURTAR_ORC_B),
        ]);
        if (drop) return;
        mirrorSwordToRight(leadG.scene);
        const lead = fitHero(leadG.scene, 0, true, true, { side: -1, march: true, blade: true });
        const allies = [a0, a1, a2, a3].map((gltf) => {
          mirrorSwordToRight(gltf.scene);
          return fitHero(gltf.scene, 0, true, true, { side: -1, march: true, blade: true });
        });
        const elf = fitHero(elfG.scene, 0, true, false);
        const src = [fitHero(orcA.scene, 0, true, false), fitHero(orcB.scene, 0, true, false)];
        const orcs = KURTAR_ORCS.map((spec) => src[spec.mesh].clone(true));
        keep.current = [lead, ...allies, elf, ...src];
        setPack({ lead, allies, elf, orcs });
        kurtarMarkReady();
      } catch (err) {
        console.warn("kurtar load failed", err);
        kurtarMarkReady();
      }
    })();
    return () => {
      drop = true;
      kurtarReset();
      for (const root of keep.current) disposeTree(root);
      keep.current = [];
    };
  }, []);
  return (
    <group>
      <hemisphereLight args={["#fff4e4", "#b08968", 0.72]} />
      <ambientLight intensity={0.78} color="#f3f6fa" />
      <directionalLight position={[-4, 11, -6]} intensity={2.2} color="#fff3e2" />
      <directionalLight position={[5, 9, 20]} intensity={1.75} color="#ffe4c4" />
      <directionalLight position={[0, 14, 28]} intensity={0.9} color="#fff8ee" />
      <Tunnel />
      <Cage />
      {pack && <Fighters pack={pack} />}
      <KurtarHud />
    </group>
  );
}
