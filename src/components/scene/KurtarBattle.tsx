import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { fitHero } from "./ArenaBattle";
import {
  KURTAR_ALLIES,
  KURTAR_ELF,
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
  for (let i = 0; i < 20; i++) {
    const z = i * 1.45 - 4.4;
    const open = z > 16 ? 1 : z > 12 ? 0.45 : 0;
    const half = 2.05 + open * 3.4;
    const h = 3.35 + open * 2.2;
    const stone = i % 2 === 0 ? "#3c342c" : "#2e2924";
    ribs.push(
      <Block key={`L${i}`} args={[0.7, h, 1.2]} position={[-half, h / 2, z]} color={stone} />,
      <Block key={`R${i}`} args={[0.7, h, 1.2]} position={[half, h / 2, z]} color={stone} />,
    );
    if (z < 16) ribs.push(<Block key={`C${i}`} args={[half * 2, 0.45, 1.2]} position={[0, h, z]} color="#241e1a" />);
  }
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 14]} receiveShadow>
        <planeGeometry args={[28, 46]} />
        <meshLambertMaterial color="#1c1814" />
      </mesh>
      <Block args={[2.4, 0.04, 34]} position={[0, 0.02, 12]} color="#3a2418" />
      {ribs}
      <Block args={[1.1, 2.6, 0.12]} position={[-1.55, 1.5, 0.2]} color="#8e1e24" />
      <Block args={[0.7, 1.4, 0.08]} position={[1.7, 1.8, 6.4]} color="#c4552a" />
      <Torch position={[-1.55, 0, -0.4]} />
      <Torch position={[1.65, 0, 4.8]} />
      <Torch position={[-1.85, 0, 9.6]} />
      <Torch position={[2.1, 0, 14.2]} />
      <Torch position={[-3.4, 0, 20.2]} />
      <Torch position={[3.4, 0, 20.4]} />
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
      <pointLight position={[0, 1.8, 0]} color="#ffb068" intensity={2.4} distance={7.5} decay={2} />
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
  for (let i = 0; i < 7; i++) rods.push(<mesh key={i} position={[-0.9 + i * 0.3, 1.15, 0]}><cylinderGeometry args={[0.045, 0.045, 2.3, 6]} /><meshLambertMaterial color="#14161a" /></mesh>);
  return (
    <group position={[0, 0, 22.15]}>
      <Block args={[2.8, 0.16, 2.4]} position={[0, 0.08, 0.7]} color="#4a4034" />
      <Block args={[8, 4.6, 0.4]} position={[0, 2.3, 2.4]} color="#2a241e" />
      <Block args={[8, 0.35, 6]} position={[0, 4.5, 0.4]} color="#1a1614" />
      <mesh position={[0, 1.2, 1.15]}>
        <sphereGeometry args={[0.55, 12, 10]} />
        <meshBasicMaterial color="#ffd2a8" transparent opacity={0.22} />
      </mesh>
      <pointLight position={[0, 2.1, 0.8]} color="#ffc48a" intensity={6} distance={9} decay={2} />
      <group ref={bars}>{rods}</group>
      <Block args={[2.4, 0.16, 0.16]} position={[0, 2.35, 0]} color="#1a1c20" />
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
  useFrame(() => {
    const t = kurtarT();
    const lead = kurtarLead(t);
    const node = leadRef.current;
    if (node) {
      node.position.set(lead.x, lead.y, lead.z);
      node.rotation.set(lead.kneel, lead.yaw + KURTAR_FACE, 0);
      for (const arm of leadArms) arm.set(lead.strike.lift, lead.strike.chop);
    }
    KURTAR_ORCS.forEach((spec, i) => {
      const body = orcRefs.current[i];
      if (!body) return;
      const pose = kurtarOrcPose(spec, t);
      body.visible = pose.show;
      body.position.set(pose.x, -pose.fall * 0.35, pose.z);
      const face = Math.atan2(-pose.x, lead.z - pose.z);
      body.rotation.set(pose.fall * 1.25, face + KURTAR_FACE, 0);
    });
    pack.allies.forEach((_, i) => {
      const body = allyRefs.current[i];
      if (!body) return;
      const pose = kurtarAllyPose(i, t);
      body.visible = pose.show;
      body.position.set(pose.x, pose.y, pose.z);
      body.rotation.set(0, pose.yaw + KURTAR_FACE, 0);
      const hit = pose.strike;
      for (const arm of allyArms[i]) arm.set(hit.lift, hit.chop);
    });
    if (elfRef.current) {
      elfRef.current.position.set(0, 0, 23.15);
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
    persp.far = 80;
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
        const lead = fitHero(leadG.scene, 0, true, true);
        const allies = [a0, a1, a2, a3].map((gltf) => fitHero(gltf.scene, 0, true, true));
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
      <ambientLight intensity={0.55} color="#c5d0dc" />
      <directionalLight position={[-3, 8, -8]} intensity={1.55} color="#ffe2c4" />
      <directionalLight position={[3, 7, 16]} intensity={1.35} color="#ffd0a4" />
      <Tunnel />
      <Cage />
      {pack && <Fighters pack={pack} />}
      <KurtarHud />
    </group>
  );
}
