import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { buildNameAtlas } from "../../nameAtlas";
import { buildKnightSoldier } from "../../knightSoldier";
import { Castle } from "./Castle";
import { fitHero } from "./ArenaBattle";
import {
  KAPI_ARCHERS,
  KAPI_DEATHS,
  KAPI_EARLY,
  KAPI_HEROES,
  KAPI_HERO_X,
  KAPI_KNIGHT,
  KAPI_LATE,
  KAPI_N,
  KAPI_ROMAN,
  type KapiArrow,
  kapiArchers,
  kapiArrow,
  kapiBreak,
  kapiCam,
  kapiCard,
  kapiFace,
  kapiLead,
  kapiMarkReady,
  kapiReset,
  kapiRoster,
  kapiRunning,
  kapiSoldier,
  kapiSwing,
  kapiT,
} from "../../kapiReel";

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

function arrowGeo() {
  const shaft = new THREE.CylinderGeometry(0.08, 0.08, 1.85, 5);
  shaft.translate(0, 0.25, 0);
  const head = new THREE.ConeGeometry(0.16, 0.38, 5);
  head.translate(0, 1.28, 0);
  const fletch = new THREE.BoxGeometry(0.28, 0.34, 0.04);
  fletch.translate(0, -0.52, 0);
  return mergeGeometries([shaft, head, fletch]) ?? shaft;
}

function hideSlabs(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (!box) return;
    const sx = box.max.x - box.min.x;
    const sy = box.max.y - box.min.y;
    const sz = box.max.z - box.min.z;
    if (sy < 0.18 && sx > 0.45 && sz > 0.45) mesh.visible = false;
  });
}

type Pack = {
  heroes: THREE.Group[];
  knight: { body: THREE.BufferGeometry; helm: THREE.BufferGeometry };
  romans: THREE.Object3D[];
};

function bowMesh() {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.035, 5, 8, Math.PI),
    new THREE.MeshLambertMaterial({ color: "#3a2414" })
  );
  mesh.position.set(0.15, 1.18, 0.48);
  mesh.rotation.set(0.4, 0.2, Math.PI / 2);
  return mesh;
}

export function KapiBattle({ names, level }: { names: string[]; level: number }) {
  const [pack, setPack] = useState<Pack | null>(null);
  const gate = useRef(0);
  const face = useMemo(() => kapiFace(level), [level]);
  const posts = useMemo(() => kapiArchers(level), [level]);
  const roster = useMemo(() => kapiRoster(names), [names]);

  useEffect(() => {
    let drop = false;
    kapiReset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const heroes: THREE.Group[] = [];
        for (const url of KAPI_HEROES) {
          const gltf = await loadGlb(loader, url);
          if (drop) return;
          mirrorSwordToRight(gltf.scene);
          fitHero(gltf.scene, Math.PI, false, true, { side: -1, march: true, blade: true });
          heroes.push(gltf.scene);
        }
        const knightGltf = await loadGlb(loader, KAPI_KNIGHT);
        const romanGltf = await loadGlb(loader, KAPI_ROMAN);
        if (drop) return;
        const knight = buildKnightSoldier(knightGltf.scene);
        fitHero(romanGltf.scene, -Math.PI / 2, true, false);
        hideSlabs(romanGltf.scene);
        romanGltf.scene.add(bowMesh());
        const romans = Array.from({ length: KAPI_ARCHERS }, () => romanGltf.scene.clone(true));
        if (drop) return;
        setPack({ heroes, knight, romans });
      } catch (err) {
        console.warn("kapi", err);
      } finally {
        if (!drop) kapiMarkReady();
      }
    })();
    return () => {
      drop = true;
      kapiReset();
    };
  }, []);

  if (!pack) {
    return <BreakClock gate={gate} />;
  }

  return (
    <group>
      <BreakClock gate={gate} />
      <Castle level={level} pressure={0} defenders={false} gateBreak={gate} />
      <Charge pack={pack} faceZ={face.z} posts={posts} roster={roster} />
    </group>
  );
}

function BreakClock({ gate }: { gate: { current: number } }) {
  useFrame(() => {
    gate.current = kapiBreak(kapiT());
  });
  return null;
}

const dummy = new THREE.Object3D();
const arrowTmp: KapiArrow = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
const up = new THREE.Vector3(0, 1, 0);
const dir = new THREE.Vector3();
const liveTint = new THREE.Color("#ffffff");
const deadTint = new THREE.Color("#5c616c");

function Charge({
  pack,
  faceZ,
  posts,
  roster,
}: {
  pack: Pack;
  faceZ: number;
  posts: { x: number; y: number; z: number }[];
  roster: string[];
}) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const helms = useRef<THREE.InstancedMesh>(null);
  const arrows = useRef<THREE.InstancedMesh>(null);
  const heroRefs = useRef<(THREE.Group | null)[]>([]);
  const arms = useMemo(() => pack.heroes.map((hero) => armsOf(hero)), [pack.heroes]);
  const geo = useMemo(() => arrowGeo(), []);
  const named = useMemo(() => roster.map((name, i) => ({ name, i })).filter((row) => row.name && row.i < 12), [roster]);
  const atlas = useMemo(
    () =>
      buildNameAtlas(
        named.map((row) => ({ text: row.name, commander: false, plain: false, fill: "#ffe14a", frame: true })),
        true,
        true
      ),
    [named]
  );
  useEffect(() => {
    for (const sheet of atlas.sheets) sheet.material.depthTest = true;
    return () => atlas.dispose();
  }, [atlas]);

  useFrame(({ camera }, delta) => {
    const t = kapiT();
    const body = bodies.current;
    const helm = helms.current;
    if (body && helm) {
      if (!body.instanceColor) body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(KAPI_N * 3).fill(1), 3);
      if (!helm.instanceColor) helm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(KAPI_N * 3).fill(1), 3);
      for (let i = 0; i < KAPI_N; i++) {
        const pose = kapiSoldier(i, t, faceZ);
        dummy.position.set(pose.x, 0, pose.z);
        dummy.rotation.set(-pose.fall * 1.5, Math.PI, pose.fall * ((i % 5) - 2) * 0.2);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        body.setMatrixAt(i, dummy.matrix);
        helm.setMatrixAt(i, dummy.matrix);
        const tint = pose.fall > 0.2 ? deadTint : liveTint;
        body.setColorAt(i, tint);
        helm.setColorAt(i, tint);
      }
      body.instanceMatrix.needsUpdate = true;
      helm.instanceMatrix.needsUpdate = true;
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
      if (helm.instanceColor) helm.instanceColor.needsUpdate = true;
    }

    const lead = kapiLead(t, faceZ);
    const moving = kapiRunning(t);
    const strike = kapiSwing(t);
    pack.heroes.forEach((_, i) => {
      const node = heroRefs.current[i];
      if (!node) return;
      node.position.set(KAPI_HERO_X[i], 0, lead);
      for (const arm of arms[i]) arm.set(strike.lift, strike.chop);
      stepGait(node, moving, moving ? 2.1 : 0, delta);
    });

    const mesh = arrows.current;
    if (mesh) {
      let n = 0;
      for (const death of KAPI_DEATHS) {
        if (n >= 24) break;
        const pose = kapiSoldier(death.i, death.t, faceZ);
        const from = posts[death.archer] ?? posts[0];
        if (!kapiArrow(t, death.t, from, { x: pose.x, y: 1.2, z: pose.z }, arrowTmp)) continue;
        dir.set(arrowTmp.dx, arrowTmp.dy, arrowTmp.dz);
        if (dir.lengthSq() < 1e-8) continue;
        dummy.position.set(arrowTmp.x, arrowTmp.y, arrowTmp.z);
        dummy.quaternion.setFromUnitVectors(up, dir.normalize());
        dummy.scale.setScalar(1.45);
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
        n += 1;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }

    for (const sheet of atlas.sheets) {
      const inst = sheet.geometry.userData.mesh as THREE.InstancedMesh | undefined;
      if (!inst) continue;
      for (let n = 0; n < named.length; n++) {
        const cell = atlas.cells[n];
        if (!cell || cell.sheet !== atlas.sheets.indexOf(sheet)) continue;
        const pose = kapiSoldier(named[n].i, t, faceZ);
        const hide = pose.fall > 0.4;
        dummy.position.set(pose.x, hide ? -8 : 2.15, pose.z);
        dummy.quaternion.copy(camera.quaternion);
        dummy.scale.set(hide ? 0.001 : cell.sx * 0.42, hide ? 0.001 : cell.sy * 0.42, 1);
        dummy.updateMatrix();
        inst.setMatrixAt(cell.local, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {pack.heroes.map((hero, i) => (
        <group key={i} ref={(node) => { heroRefs.current[i] = node; }}>
          <primitive object={hero} />
        </group>
      ))}
      {pack.romans.map((roman, i) => (
        <group key={i} position={[posts[i].x, posts[i].y, posts[i].z]} scale={2.15}>
          <primitive object={roman} />
        </group>
      ))}
      <instancedMesh ref={bodies} args={[pack.knight.body, undefined, KAPI_N]} frustumCulled={false} count={KAPI_N}>
        <meshLambertMaterial color="#1a56e8" />
      </instancedMesh>
      <instancedMesh ref={helms} args={[pack.knight.helm, undefined, KAPI_N]} frustumCulled={false} count={KAPI_N}>
        <meshLambertMaterial color="#e7eef5" />
      </instancedMesh>
      <instancedMesh ref={arrows} args={[geo, undefined, 24]} frustumCulled={false} count={0}>
        <meshBasicMaterial color="#ffb03a" />
      </instancedMesh>
      {atlas.sheets.map((sheet, s) => (
        <instancedMesh
          key={s}
          args={[sheet.geometry, sheet.material, Math.max(1, sheet.count)]}
          frustumCulled={false}
          ref={(node) => {
            sheet.geometry.userData.mesh = node;
          }}
        />
      ))}
      <Splinters faceZ={faceZ} />
      <KapiHud />
    </group>
  );
}

function Splinters({ faceZ }: { faceZ: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const seeds = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        ang: (i / 8) * Math.PI * 2 + 0.4,
        speed: 2.2 + (i % 3) * 0.65,
        up: 2.8 + (i % 4) * 0.45,
        w: 0.16 + (i % 3) * 0.07,
      })),
    []
  );
  useFrame(() => {
    const age = kapiT() - 15.55;
    const show = age > 0 && age < 2.3;
    seeds.forEach((seed, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      mesh.visible = show;
      if (!show) return;
      mesh.position.set(
        Math.cos(seed.ang) * seed.speed * age,
        1.5 + seed.up * age - age * age * 2.1,
        faceZ + 1.1 + Math.sin(seed.ang) * seed.speed * age * 0.4
      );
      mesh.rotation.set(age * 3, age * 2, age);
    });
  });
  return (
    <group>
      {seeds.map((seed, i) => (
        <mesh key={i} ref={(node) => { refs.current[i] = node; }} visible={false} scale={1.8}>
          <boxGeometry args={[seed.w, seed.w * 0.42, seed.w * 1.5]} />
          <meshLambertMaterial color={i % 2 ? "#6b3b1c" : "#8d8478"} />
        </mesh>
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
  const tall = lines.length > 2;
  const canvas = document.createElement("canvas");
  canvas.width = 980;
  canvas.height = tall ? 420 : 280;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  roundRect(ctx, 28, 22, 924, canvas.height - 44, 32);
  ctx.fillStyle = "#ffd54f";
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#111111";
  ctx.stroke();
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = tall ? "900 78px Montserrat, Helvetica, Arial, sans-serif" : "900 92px Montserrat, Helvetica, Arial, sans-serif";
  const top = tall ? 108 : 104;
  const gap = tall ? 118 : 94;
  lines.forEach((line, i) => ctx.fillText(line, 490, top + i * gap));
  return canvas;
}

function cardTex(lines: readonly string[]) {
  const map = new THREE.CanvasTexture(paintCard(lines));
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = false;
  map.minFilter = THREE.LinearFilter;
  map.magFilter = THREE.LinearFilter;
  return map;
}

function KapiHud() {
  const size = useThree((s) => s.size);
  const early = useRef<THREE.Mesh>(null);
  const late = useRef<THREE.Mesh>(null);
  const maps = useMemo(() => [cardTex(KAPI_EARLY), cardTex(KAPI_LATE)], []);
  useEffect(() => {
    document.fonts?.load("900 80px Montserrat").then(() => {
      maps[0].image = paintCard(KAPI_EARLY);
      maps[1].image = paintCard(KAPI_LATE);
      maps[0].needsUpdate = true;
      maps[1].needsUpdate = true;
    }).catch(() => undefined);
  }, [maps]);
  useEffect(() => () => {
    maps.forEach((map) => map.dispose());
  }, [maps]);
  useFrame(() => {
    const card = kapiCard(kapiT());
    const earlyOn = card?.lines.length === 2;
    const lateOn = card?.lines.length === 3;
    if (early.current) {
      early.current.visible = Boolean(earlyOn);
      const mat = early.current.material as THREE.MeshBasicMaterial;
      mat.opacity = earlyOn ? card!.opacity : 0;
    }
    if (late.current) {
      late.current.visible = Boolean(lateOn);
      const mat = late.current.material as THREE.MeshBasicMaterial;
      mat.opacity = lateOn ? card!.opacity : 0;
    }
  });
  const cardW = size.width * 0.58;
  return (
    <Hud renderPriority={1}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh ref={early} position={[0, size.height * 0.32, 0]}>
        <planeGeometry args={[cardW, cardW * (280 / 980)]} />
        <meshBasicMaterial map={maps[0]} transparent depthTest={false} toneMapped={false} />
      </mesh>
      <mesh ref={late} position={[0, size.height * 0.3, 0]}>
        <planeGeometry args={[cardW, cardW * (420 / 980)]} />
        <meshBasicMaterial map={maps[1]} transparent depthTest={false} toneMapped={false} />
      </mesh>
    </Hud>
  );
}

export function KapiCam({ level }: { level: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const face = useMemo(() => kapiFace(level), [level]);
  useFrame(() => {
    const shot = kapiCam(kapiT(), face.z, face.y);
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
