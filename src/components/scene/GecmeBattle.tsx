import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { fitHero } from "./ArenaBattle";
import {
  GECME_FACE,
  GECME_GUEST,
  GECME_LEAD,
  GECME_LINES,
  GECME_ORCS,
  GECME_ORC_A,
  GECME_ORC_B,
  gecmeCam,
  gecmeCard,
  gecmeGuest,
  gecmeHold,
  gecmeLead,
  gecmeMarkReady,
  gecmeOrcPose,
  gecmeReset,
  gecmeT,
} from "../../gecmeReel";

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

function stepGait(root: THREE.Object3D, moving: boolean, speed: number, delta: number) {
  root.traverse((obj) => {
    const gait = obj.userData.gait as THREE.Vector2 | undefined;
    if (!gait) return;
    const target = moving ? Math.min(1, speed / 2.4) : 0;
    gait.y += (target - gait.y) * Math.min(1, delta * 9);
    gait.x += Math.max(0, speed) * 3.4 * delta;
  });
}

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
}: {
  args: [number, number, number];
  position: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position} castShadow={false} receiveShadow>
      <boxGeometry args={args} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

function Hall() {
  const pillars = [];
  for (let i = 0; i < 8; i++) {
    const z = -1.2 + i * 3.35;
    const stone = i % 2 === 0 ? "#8d7562" : "#7c6756";
    pillars.push(
      <Block key={`L${i}`} args={[0.42, 3.5, 0.42]} position={[-4.35, 1.75, z]} color={stone} />,
      <Block key={`R${i}`} args={[0.42, 3.5, 0.42]} position={[4.35, 1.75, z]} color={stone} />,
    );
  }
  const flames = [-0.4, 6.2, 12.4, 18.2];
  return (
    <group>
      <Block args={[14.5, 0.08, 34]} position={[0, -0.04, 12]} color="#d7c4ae" />
      <Block args={[0.42, 3.7, 34]} position={[-6.5, 1.85, 12]} color="#b7a08c" />
      <Block args={[0.42, 3.7, 34]} position={[6.5, 1.85, 12]} color="#b7a08c" />
      <Block args={[13.4, 3.7, 0.42]} position={[0, 1.85, 28.6]} color="#a8927c" />
      {pillars}
      <mesh position={[1.15, 2.25, 3.55]}>
        <boxGeometry args={[0.08, 1.7, 0.95]} />
        <meshLambertMaterial color="#d24a3a" />
      </mesh>
      {flames.map((z) => (
        <group key={z} position={[3.55, 0, z]}>
          <mesh position={[0, 1.15, 0]}>
            <boxGeometry args={[0.12, 1.5, 0.12]} />
            <meshLambertMaterial color="#5c4636" />
          </mesh>
          <mesh position={[0, 2.05, 0]}>
            <sphereGeometry args={[0.16, 8, 6]} />
            <meshBasicMaterial color="#ffb15a" />
          </mesh>
        </group>
      ))}
      <pointLight position={[1.2, 2.4, 2.2]} color="#ffd0a4" intensity={1.15} distance={8} decay={2} />
      <pointLight position={[-1.4, 2.6, 9.2]} color="#ffd0a4" intensity={0.85} distance={8} decay={2} />
    </group>
  );
}

type Pack = { lead: THREE.Group; guest: THREE.Group; orcs: THREE.Group[] };

function Fighters({ pack }: { pack: Pack }) {
  const leadRef = useRef<THREE.Group>(null);
  const guestRef = useRef<THREE.Group>(null);
  const orcRefs = useRef<Array<THREE.Group | null>>([]);
  const leadArms = useMemo(() => armsOf(pack.lead), [pack.lead]);
  const guestArms = useMemo(() => armsOf(pack.guest), [pack.guest]);
  const prevLead = useRef(0);
  const prevGuest = useRef(0);
  useFrame((_, delta) => {
    const t = gecmeT();
    const dt = Math.min(0.05, delta);
    const lead = gecmeLead(t);
    const node = leadRef.current;
    if (node) {
      const speed = Math.abs(lead.z - prevLead.current) / Math.max(dt, 1e-4);
      prevLead.current = lead.z;
      node.position.set(lead.x, lead.y, lead.z);
      node.rotation.set(0, lead.yaw + GECME_FACE, 0);
      for (const arm of leadArms) arm.set(lead.strike.lift, lead.strike.chop);
      const striking = lead.strike.chop > 0.35 || lead.strike.lift > 0.72;
      stepGait(pack.lead, !striking && speed > 0.45, speed, dt);
    }
    const guest = gecmeGuest(t);
    const guestNode = guestRef.current;
    if (guestNode) {
      const speed = Math.abs(guest.z - prevGuest.current) / Math.max(dt, 1e-4);
      prevGuest.current = guest.z;
      guestNode.position.set(guest.x, 0, guest.z);
      guestNode.rotation.set(0, guest.yaw + GECME_FACE, 0);
      for (const arm of guestArms) arm.set(guest.strike.lift, guest.strike.chop);
      const striking = guest.strike.chop > 0.35 || guest.strike.lift > 0.72;
      stepGait(pack.guest, !striking && speed > 0.45, speed, dt);
    }
    GECME_ORCS.forEach((spec, i) => {
      const body = orcRefs.current[i];
      if (!body) return;
      const pose = gecmeOrcPose(spec, t);
      body.visible = pose.show;
      body.position.set(pose.x, 0, pose.z);
      const aimZ = t < spec.hit ? lead.z : pose.z - 1.4;
      const face = Math.atan2(lead.x - pose.x, aimZ - pose.z);
      body.rotation.set(pose.fall * 1.35, face + GECME_FACE, pose.fall * (i % 2 === 0 ? 0.22 : -0.22));
    });
  });
  return (
    <group>
      <group ref={leadRef} scale={1.06}>
        <primitive object={pack.lead} />
      </group>
      <group ref={guestRef} scale={1.02}>
        <primitive object={pack.guest} />
      </group>
      {pack.orcs.map((orc, i) => (
        <group key={i} ref={(node) => { orcRefs.current[i] = node; }}>
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

function paintCard(lines: readonly string[]) {
  const canvas = document.createElement("canvas");
  canvas.width = 980;
  canvas.height = 300;
  const ctx = canvas.getContext("2d");
  if (!ctx || lines.length === 0) return canvas;
  roundRect(ctx, 24, 28, 932, 244, 36);
  ctx.fillStyle = "#ffd54f";
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#111111";
  ctx.stroke();
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 92px Montserrat, Helvetica, Arial, sans-serif";
  ctx.fillText(lines[0], 490, 112);
  ctx.fillText(lines[1] ?? "", 490, 206);
  return canvas;
}

function GecmeHud() {
  const size = useThree((s) => s.size);
  const cardMat = useRef<THREE.MeshBasicMaterial>(null);
  const shown = useRef("");
  const cards = useMemo(() => {
    return GECME_LINES.map((lines) => {
      const map = new THREE.CanvasTexture(paintCard(lines));
      map.colorSpace = THREE.SRGBColorSpace;
      map.generateMipmaps = false;
      map.minFilter = THREE.LinearFilter;
      map.magFilter = THREE.LinearFilter;
      return map;
    });
  }, []);
  useEffect(() => {
    document.fonts?.load("900 80px Montserrat").then(() => {
      GECME_LINES.forEach((lines, i) => {
        cards[i].image = paintCard(lines);
        cards[i].needsUpdate = true;
      });
    }).catch(() => undefined);
  }, [cards]);
  useEffect(() => () => {
    for (const map of cards) map.dispose();
  }, [cards]);
  useFrame(() => {
    const card = gecmeCard(gecmeT());
    const mat = cardMat.current;
    if (!mat) return;
    mat.opacity = card.opacity;
    const key = card.lines.join("|");
    const index = GECME_LINES.findIndex((lines) => lines.join("|") === key);
    if (shown.current !== key && index >= 0) {
      shown.current = key;
      mat.map = cards[index];
      mat.needsUpdate = true;
    }
  });
  const cardW = size.width * 0.7;
  const cardH = cardW * (300 / 980);
  return (
    <Hud renderPriority={1}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh position={[0, size.height * 0.3, 5]} renderOrder={40}>
        <planeGeometry args={[cardW, cardH]} />
        <meshBasicMaterial ref={cardMat} map={cards[0]} transparent depthTest={false} toneMapped={false} />
      </mesh>
    </Hud>
  );
}

export function GecmeCam() {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = gecmeCam(gecmeT());
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

export function GecmeBattle() {
  const [pack, setPack] = useState<Pack | null>(null);
  const keep = useRef<THREE.Object3D[]>([]);
  useEffect(() => {
    gecmeHold();
    let drop = false;
    const loader = new GLTFLoader();
    (async () => {
      try {
        const [leadG, guestG, orcA, orcB] = await Promise.all([
          loadGlb(loader, GECME_LEAD),
          loadGlb(loader, GECME_GUEST),
          loadGlb(loader, GECME_ORC_A),
          loadGlb(loader, GECME_ORC_B),
        ]);
        if (drop) return;
        mirrorSwordToRight(leadG.scene);
        mirrorSwordToRight(guestG.scene);
        const lead = fitHero(leadG.scene, 0, true, true, { side: -1, march: true, blade: true });
        const guest = fitHero(guestG.scene, 0, true, true, { side: -1, march: true, blade: true });
        const src = [fitHero(orcA.scene, 0, true, false), fitHero(orcB.scene, 0, true, false)];
        const orcs = GECME_ORCS.map((spec) => src[spec.mesh].clone(true));
        keep.current = [lead, guest, ...src];
        setPack({ lead, guest, orcs });
        gecmeMarkReady();
      } catch (err) {
        console.warn("gecme load failed", err);
        gecmeMarkReady();
      }
    })();
    return () => {
      drop = true;
      gecmeReset();
      for (const root of keep.current) disposeTree(root);
      keep.current = [];
    };
  }, []);
  return (
    <group>
      <hemisphereLight args={["#fff6ea", "#c4a07a", 0.8]} />
      <ambientLight intensity={0.72} color="#f4f1ea" />
      <directionalLight position={[-3.5, 9, -4]} intensity={2.35} color="#fff4e6" />
      <directionalLight position={[4, 7, 16]} intensity={1.15} color="#ffe0c2" />
      <Hall />
      {pack && <Fighters pack={pack} />}
      <GecmeHud />
    </group>
  );
}
