import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { fitHero } from "./ArenaBattle";
import {
  KUYU_CATCH_Y,
  KUYU_FACE,
  KUYU_HAND,
  KUYU_LEAD,
  KUYU_LINES,
  KUYU_ORCS,
  KUYU_ORC_A,
  KUYU_ORC_B,
  kuyuCam,
  kuyuCard,
  kuyuHand,
  kuyuHeroY,
  kuyuHold,
  kuyuLead,
  kuyuLeftLedges,
  kuyuMarkReady,
  kuyuOrcPose,
  kuyuReset,
  kuyuT,
} from "../../kuyuReel";

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

function stripeMap() {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#5c4b3e" : "#2c241e";
      ctx.fillRect(0, i * 8, 8, 8);
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.repeat.set(1, 28);
  return map;
}

function Shaft() {
  const map = useMemo(stripeMap, []);
  const ledges = useMemo(kuyuLeftLedges, []);
  const orcLedges = useMemo(
    () => KUYU_ORCS.map((orc) => ({ x: orc.x, y: kuyuHeroY(orc.hit) + 0.02, z: orc.z })),
    [],
  );
  useEffect(() => () => map.dispose(), [map]);
  const wall = (position: [number, number, number], rotation: [number, number, number]) => (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[2.6, 58]} />
      <meshLambertMaterial map={map} color="#8a7362" side={THREE.DoubleSide} />
    </mesh>
  );
  return (
    <group>
      {wall([1.22, -22, 0], [0, -Math.PI / 2, 0])}
      {wall([-1.22, -22, 0], [0, Math.PI / 2, 0])}
      {wall([0, -22, 1.28], [0, Math.PI, 0])}
      {wall([0, -22, -2.45], [0, 0, 0])}
      {orcLedges.map((ledge, i) => (
        <mesh key={`r${i}`} position={[ledge.x, ledge.y, ledge.z]}>
          <boxGeometry args={[0.85, 0.14, 0.48]} />
          <meshLambertMaterial color="#7a6554" />
        </mesh>
      ))}
      {ledges.map((ledge, i) => (
        <group key={`l${i}`} position={[ledge.x, ledge.y, ledge.z]}>
          <mesh>
            <boxGeometry args={[0.7, 0.14, 0.42]} />
            <meshLambertMaterial color="#6d5848" />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.1, 8, 6]} />
            <meshBasicMaterial color="#ffb15a" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, KUYU_CATCH_Y + 0.9, 0.35]}>
        <boxGeometry args={[2.2, 0.22, 1.5]} />
        <meshLambertMaterial color="#a48468" />
      </mesh>
      <mesh position={[0, KUYU_CATCH_Y - 2.4, 0.2]}>
        <planeGeometry args={[1.6, 2.2]} />
        <meshBasicMaterial color="#ff9a3c" transparent opacity={0.35} />
      </mesh>
      <pointLight position={[0.1, KUYU_CATCH_Y + 1.4, 0.2]} color="#ffb060" intensity={7} distance={16} decay={2} />
      {[-0.55, -0.15, 0.28, 0.62].map((x, i) => (
        <mesh key={x} position={[x, KUYU_CATCH_Y - 3.1 - (i % 2) * 0.45, 0.35]}>
          <sphereGeometry args={[0.08, 8, 6]} />
          <meshBasicMaterial color={i % 2 ? "#d6ff6a" : "#ffd27a"} />
        </mesh>
      ))}
    </group>
  );
}

function FollowLight() {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const y = kuyuHeroY(kuyuT());
    ref.current?.position.set(-0.15, y + 1.35, -0.35);
  });
  return <pointLight ref={ref} color="#fff1df" intensity={2.4} distance={7} decay={2} />;
}

type Pack = { lead: THREE.Group; hand: THREE.Group; orcs: THREE.Group[] };

function Fighters({ pack }: { pack: Pack }) {
  const leadRef = useRef<THREE.Group>(null);
  const handRef = useRef<THREE.Group>(null);
  const orcRefs = useRef<Array<THREE.Group | null>>([]);
  const leadArms = useMemo(() => armsOf(pack.lead), [pack.lead]);
  const handArms = useMemo(() => armsOf(pack.hand), [pack.hand]);
  useFrame(() => {
    const t = kuyuT();
    const lead = kuyuLead(t);
    const node = leadRef.current;
    if (node) {
      node.position.set(lead.x, lead.y, lead.z);
      node.rotation.set(0, lead.yaw + KUYU_FACE, 0);
      for (const arm of leadArms) arm.set(lead.strike.lift, lead.strike.chop);
    }
    const hand = kuyuHand(t);
    const handNode = handRef.current;
    if (handNode) {
      handNode.visible = hand.show;
      handNode.position.set(hand.x, hand.y, hand.z);
      handNode.rotation.set(0, hand.yaw + KUYU_FACE, 0);
      for (const arm of handArms) arm.set(hand.strike.lift, hand.strike.chop);
    }
    KUYU_ORCS.forEach((spec, i) => {
      const body = orcRefs.current[i];
      if (!body) return;
      const pose = kuyuOrcPose(spec, t);
      body.visible = pose.show;
      body.position.set(pose.x, pose.y, pose.z);
      const face = Math.atan2(-pose.x, -pose.z);
      body.rotation.set(pose.fall * 1.25, face + KUYU_FACE, pose.fall * (i % 2 === 0 ? 0.35 : -0.35));
    });
  });
  return (
    <group>
      <group ref={leadRef} scale={1.02}>
        <primitive object={pack.lead} />
      </group>
      <group ref={handRef} scale={1.02}>
        <primitive object={pack.hand} />
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
  canvas.height = 280;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  roundRect(ctx, 30, 24, 920, 232, 34);
  ctx.fillStyle = "#ffd54f";
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#111111";
  ctx.stroke();
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 96px Montserrat, Helvetica, Arial, sans-serif";
  ctx.fillText(lines[0], 490, 104);
  ctx.fillText(lines[1] ?? "", 490, 198);
  return canvas;
}

function KuyuHud() {
  const size = useThree((s) => s.size);
  const cardMat = useRef<THREE.MeshBasicMaterial>(null);
  const shown = useRef("");
  const cards = useMemo(() => {
    return KUYU_LINES.map((lines) => {
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
      KUYU_LINES.forEach((lines, i) => {
        cards[i].image = paintCard(lines);
        cards[i].needsUpdate = true;
      });
    }).catch(() => undefined);
  }, [cards]);
  useEffect(() => () => {
    for (const map of cards) map.dispose();
  }, [cards]);
  useFrame(() => {
    const card = kuyuCard(kuyuT());
    const mat = cardMat.current;
    if (!mat) return;
    mat.opacity = card.opacity;
    const key = card.lines.join("|");
    const index = KUYU_LINES.findIndex((lines) => lines.join("|") === key);
    if (shown.current !== key && index >= 0) {
      shown.current = key;
      mat.map = cards[index];
      mat.needsUpdate = true;
    }
  });
  const cardW = size.width * 0.62;
  const cardH = cardW * (280 / 980);
  return (
    <Hud renderPriority={1}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh position={[0, size.height * 0.34, 5]} renderOrder={40}>
        <planeGeometry args={[cardW, cardH]} />
        <meshBasicMaterial ref={cardMat} map={cards[0]} transparent depthTest={false} toneMapped={false} />
      </mesh>
    </Hud>
  );
}

export function KuyuCam() {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = kuyuCam(kuyuT());
    persp.fov = shot.fov;
    persp.near = 0.12;
    persp.far = 80;
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

export function KuyuBattle() {
  const [pack, setPack] = useState<Pack | null>(null);
  const keep = useRef<THREE.Object3D[]>([]);
  useEffect(() => {
    kuyuHold();
    let drop = false;
    const loader = new GLTFLoader();
    (async () => {
      try {
        const [leadG, handG, orcA, orcB] = await Promise.all([
          loadGlb(loader, KUYU_LEAD),
          loadGlb(loader, KUYU_HAND),
          loadGlb(loader, KUYU_ORC_A),
          loadGlb(loader, KUYU_ORC_B),
        ]);
        if (drop) return;
        mirrorSwordToRight(leadG.scene);
        mirrorSwordToRight(handG.scene);
        const lead = fitHero(leadG.scene, 0, true, true, { side: -1, march: true, blade: true });
        const hand = fitHero(handG.scene, 0, true, true, { side: -1, march: true, blade: true });
        const src = [fitHero(orcA.scene, 0, true, false), fitHero(orcB.scene, 0, true, false)];
        const orcs = KUYU_ORCS.map((spec) => src[spec.mesh].clone(true));
        keep.current = [lead, hand, ...src];
        setPack({ lead, hand, orcs });
        kuyuMarkReady();
      } catch (err) {
        console.warn("kuyu load failed", err);
        kuyuMarkReady();
      }
    })();
    return () => {
      drop = true;
      kuyuReset();
      for (const root of keep.current) disposeTree(root);
      keep.current = [];
    };
  }, []);
  return (
    <group>
      <hemisphereLight args={["#d8c2a4", "#2a211c", 0.55]} />
      <ambientLight intensity={0.34} color="#f0e4d4" />
      <directionalLight position={[-2.2, 6, -3]} intensity={2.4} color="#fff3e4" />
      <Shaft />
      <FollowLight />
      {pack && <Fighters pack={pack} />}
      <KuyuHud />
    </group>
  );
}
