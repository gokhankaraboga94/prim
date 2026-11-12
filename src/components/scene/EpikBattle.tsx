import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import * as THREE from "three";
import { buildKnightSoldier } from "../../knightSoldier";
import { buildNameAtlas } from "../../nameAtlas";
import {
  EPIK_ARMY,
  EPIK_HERO,
  EPIK_KNIGHT,
  EPIK_NAMES,
  epikCam,
  epikCharge,
  epikFade,
  epikHeroFocus,
  epikMarkReady,
  epikReset,
  epikRoster,
  epikSpark,
  epikT,
} from "../../epikReel";

const HEIGHT = 1.82;
const CASTLE_Z = -42;
const GATE_Z = -28;
const PLATE = 1.15;
const dummy = new THREE.Object3D();

type Hero = {
  i: number;
  hold: THREE.Group;
  mix: THREE.AnimationMixer;
  idle: THREE.AnimationAction | null;
  run: THREE.AnimationAction | null;
  baseX: number;
  baseZ: number;
};

function toPremium(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    mesh.material = new THREE.MeshStandardMaterial({
      map: src.map ?? null,
      color: src.color ? src.color.clone() : new THREE.Color("#d8dde4"),
      roughness: Math.min(0.55, src.roughness ?? 0.35),
      metalness: Math.max(0.45, src.metalness ?? 0.55),
      envMapIntensity: 1.35,
    });
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
  });
}

function fit(root: THREE.Object3D, height = HEIGHT) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const span = Math.max(0.001, box.max.y - box.min.y);
  const scale = height / span;
  root.scale.setScalar(scale);
  root.position.set(-((box.min.x + box.max.x) / 2) * scale, -box.min.y * scale, -((box.min.z + box.max.z) / 2) * scale);
}

function pickClip(clips: THREE.AnimationClip[], keys: string[]) {
  for (const key of keys) {
    const hit = clips.find((clip) => clip.name.toLowerCase().includes(key));
    if (hit) return hit;
  }
  return clips[0] ?? null;
}

function armySlots() {
  const out: { x: number; z: number }[] = [];
  const blocks = [
    { ox: -14, oz: 34, cols: 8, rows: 9 },
    { ox: 2, oz: 34, cols: 8, rows: 9 },
    { ox: -14, oz: 52, cols: 8, rows: 9 },
    { ox: 2, oz: 52, cols: 8, rows: 9 },
  ];
  for (const block of blocks) {
    for (let r = 0; r < block.rows; r++) {
      for (let c = 0; c < block.cols; c++) {
        if (out.length >= EPIK_ARMY) return out;
        out.push({ x: block.ox + c * 1.55, z: block.oz + r * 1.55 });
      }
    }
  }
  return out;
}

const SLOTS = armySlots();

function Fortress() {
  const stone = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#8d867c";
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 16; y++) {
      for (let x = -1; x < 16; x++) {
        const ox = (y % 2) * 16;
        ctx.fillStyle = `rgb(${130 + ((x * 7 + y * 3) % 40)},${120 + ((x + y) % 28)},${108 + ((x * 5) % 22)})`;
        ctx.fillRect(x * 32 + ox + 2, y * 32 + 2, 28, 28);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 3);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
  useEffect(() => () => stone?.dispose(), [stone]);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: stone ?? undefined,
        color: "#cfc7bb",
        roughness: 0.82,
        metalness: 0.08,
        envMapIntensity: 0.55,
      }),
    [stone],
  );
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a241e", roughness: 0.9, metalness: 0.05 }), []);
  useEffect(() => () => {
    mat.dispose();
    dark.dispose();
  }, [mat, dark]);
  const towers = useMemo(() => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      pts.push([Math.sin(a) * 22, Math.cos(a) * 22 + CASTLE_Z]);
    }
    return pts;
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, CASTLE_Z]} material={mat}>
        <ringGeometry args={[20.5, 23.2, 48]} />
      </mesh>
      {towers.map(([x, z], i) => (
        <mesh key={i} position={[x, 4.2, z]} material={mat}>
          <cylinderGeometry args={[1.35, 1.55, 8.4, 10]} />
        </mesh>
      ))}
      <mesh position={[0, 7.5, CASTLE_Z]} material={mat}>
        <boxGeometry args={[10, 15, 10]} />
      </mesh>
      <mesh position={[0, 16.2, CASTLE_Z]} material={mat}>
        <cylinderGeometry args={[0.7, 1.4, 6, 8]} />
      </mesh>
      <mesh position={[0, 3.4, GATE_Z]} material={dark}>
        <boxGeometry args={[7.2, 6.8, 1.2]} />
      </mesh>
      <mesh position={[-4.2, 4.5, GATE_Z]} material={mat}>
        <cylinderGeometry args={[1.6, 1.8, 9, 10]} />
      </mesh>
      <mesh position={[4.2, 4.5, GATE_Z]} material={mat}>
        <cylinderGeometry args={[1.6, 1.8, 9, 10]} />
      </mesh>
    </group>
  );
}

function GodRays() {
  const mats = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) =>
        new THREE.MeshBasicMaterial({
          color: "#ffd7a0",
          transparent: true,
          opacity: 0.045 + i * 0.012,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      ),
    [],
  );
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  return (
    <group position={[-18, 38, -10]} rotation={[0.35, 0.55, -0.2]}>
      {mats.map((mat, i) => (
        <mesh key={i} position={[0, 0, i * 1.4]} rotation={[0, 0, i * 0.04]} material={mat}>
          <planeGeometry args={[8 + i * 2.2, 70]} />
        </mesh>
      ))}
    </group>
  );
}

function EpikEnv() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 1.05;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function EpikArmy({ body, helm }: { body: THREE.BufferGeometry; helm: THREE.BufferGeometry }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const helmRef = useRef<THREE.InstancedMesh>(null);
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#cfd6de", roughness: 0.28, metalness: 0.78, envMapIntensity: 1.2 }),
    [],
  );
  const helmMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#eef2f6", roughness: 0.16, metalness: 0.92, envMapIntensity: 1.4 }),
    [],
  );
  useEffect(() => () => {
    bodyMat.dispose();
    helmMat.dispose();
  }, [bodyMat, helmMat]);

  useFrame(() => {
    const charge = epikCharge(epikT());
    const bodyMesh = bodyRef.current;
    const helmMesh = helmRef.current;
    if (!bodyMesh || !helmMesh) return;
    for (let i = 0; i < SLOTS.length; i++) {
      const slot = SLOTS[i];
      const z = slot.z - charge * 54;
      const bob = charge > 0.02 ? Math.sin(epikT() * 10 + i) * 0.03 : 0;
      dummy.position.set(slot.x + Math.sin(i * 1.7) * 0.05, bob, z);
      dummy.rotation.set(0, Math.PI, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bodyMesh.setMatrixAt(i, dummy.matrix);
      helmMesh.setMatrixAt(i, dummy.matrix);
    }
    bodyMesh.instanceMatrix.needsUpdate = true;
    helmMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[body, bodyMat, SLOTS.length]} frustumCulled={false} />
      <instancedMesh ref={helmRef} args={[helm, helmMat, SLOTS.length]} frustumCulled={false} />
    </group>
  );
}

function Arrows() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#1a1510" }), []);
  const geo = useMemo(() => new THREE.BoxGeometry(0.04, 0.04, 1.4), []);
  useEffect(() => () => {
    mat.dispose();
    geo.dispose();
  }, [mat, geo]);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const on = epikSpark(epikT());
    mesh.visible = on;
    if (!on) return;
    const t = epikT();
    for (let i = 0; i < 90; i++) {
      const u = (i * 17.3 + t * 28) % 40;
      dummy.position.set(((i * 13) % 21) - 10, 6 + ((i * 7) % 9), 20 - u * 1.8);
      dummy.rotation.set(-0.55, 0.1, 0.05);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, 90]} frustumCulled={false} />;
}

function Dust() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) {
      pos[i * 3] = ((i * 17) % 40) - 20;
      pos[i * 3 + 1] = 0.2 + (i % 7) * 0.08;
      pos[i * 3 + 2] = ((i * 23) % 50) + 5;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const mat = useMemo(
    () => new THREE.PointsMaterial({ color: "#8a7a62", size: 0.35, transparent: true, opacity: 0.35, depthWrite: false }),
    [],
  );
  useEffect(() => () => {
    geo.dispose();
    mat.dispose();
  }, [geo, mat]);
  useFrame(() => {
    const pts = ref.current;
    if (!pts) return;
    const on = epikSpark(epikT());
    pts.visible = on;
    if (!on) return;
    const charge = epikCharge(epikT());
    const attr = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < attr.count; i++) {
      attr.setY(i, 0.15 + ((i + epikT() * 8) % 5) * 0.12);
      attr.setZ(i, 30 - charge * 54 + ((i * 11) % 20));
    }
    attr.needsUpdate = true;
  });
  return <points ref={ref} geometry={geo} material={mat} />;
}

export function EpikBattle({ names }: { names: string[] }) {
  const host = useRef<THREE.Group>(null);
  const heroes = useRef<Hero[]>([]);
  const [knight, setKnight] = useState<{ body: THREE.BufferGeometry; helm: THREE.BufferGeometry } | null>(null);
  const roster = useMemo(() => epikRoster(names), [names]);
  const named = useMemo(() => roster.map((name, i) => ({ name, i })).filter((row) => row.name), [roster]);
  const atlas = useMemo(
    () =>
      buildNameAtlas(
        named.map((row) => ({ text: row.name, commander: false, plain: false, fill: "#1a1208", frame: true, plate: "rgba(232,198,110,0.92)" })),
        true,
        false,
      ),
    [named],
  );

  useEffect(() => {
    for (const sheet of atlas.sheets) sheet.material.depthTest = false;
    return () => atlas.dispose();
  }, [atlas]);

  useEffect(() => {
    let drop = false;
    epikReset();
    const loader = new GLTFLoader();
    void Promise.all([
      new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((ok, fail) =>
        loader.load(EPIK_HERO, (g) => ok({ scene: g.scene, animations: g.animations }), undefined, fail),
      ),
      new Promise<THREE.Group>((ok, fail) => loader.load(EPIK_KNIGHT, (g) => ok(g.scene), undefined, fail)),
    ])
      .then(([heroFile, knightScene]) => {
        if (drop || !host.current) return;
        const root = host.current;
        toPremium(heroFile.scene);
        fit(heroFile.scene);
        const idleClip = pickClip(heroFile.animations, ["idle", "defensive", "stance", "stand"]);
        const runClip = pickClip(heroFile.animations, ["run", "sprint", "walk"]);
        const ours: Hero[] = [];
        for (let i = 0; i < EPIK_NAMES; i++) {
          const body = i === 0 ? heroFile.scene : cloneSkinned(heroFile.scene);
          if (i > 0) toPremium(body);
          const hold = new THREE.Group();
          hold.add(body);
          const baseX = (i - 1) * 1.7;
          const baseZ = 27.4;
          hold.position.set(baseX, 0, baseZ);
          hold.rotation.y = Math.PI;
          root.add(hold);
          const mix = new THREE.AnimationMixer(body);
          const idle = idleClip ? mix.clipAction(idleClip) : null;
          const run = runClip ? mix.clipAction(runClip) : null;
          idle?.play();
          ours.push({ i, hold, mix, idle, run, baseX, baseZ });
        }
        heroes.current = ours;
        setKnight(buildKnightSoldier(knightScene));
        epikMarkReady();
      })
      .catch((err) => console.warn("epik", err));
    return () => {
      drop = true;
      for (const man of heroes.current) man.mix.stopAllAction();
      heroes.current = [];
      setKnight((prev) => {
        prev?.body.dispose();
        prev?.helm.dispose();
        return null;
      });
      host.current?.clear();
      epikReset();
    };
  }, []);

  useFrame(({ camera }) => {
    const t = epikT();
    const charge = epikCharge(t);
    const focus = epikHeroFocus(t);
    for (const man of heroes.current) {
      const z = man.baseZ - charge * 54;
      man.hold.position.set(man.baseX, 0, z);
      man.hold.rotation.y = Math.PI;
      if (charge > 0.02) {
        man.idle?.stop();
        if (man.run && !man.run.isRunning()) man.run.reset().play();
        const clip = man.run?.getClip();
        if (man.run && clip) man.mix.setTime((t * 1.4 + man.i) % Math.max(0.01, clip.duration));
      } else {
        man.run?.stop();
        if (man.idle && !man.idle.isRunning()) man.idle.reset().play();
        const clip = man.idle?.getClip();
        if (man.idle && clip) man.mix.setTime((t * 0.35 + man.i) % Math.max(0.01, clip.duration));
      }
      man.hold.visible = focus < 0 || man.i === focus;
    }
    for (const sheet of atlas.sheets) {
      const inst = sheet.geometry.userData.mesh as THREE.InstancedMesh | undefined;
      if (!inst) continue;
      for (let n = 0; n < named.length; n++) {
        const cell = atlas.cells[n];
        if (!cell || cell.sheet !== atlas.sheets.indexOf(sheet)) continue;
        const show = epikHeroFocus(t) === named[n].i;
        const x = (named[n].i - 1) * 1.7;
        const z = 27.4 - charge * 54;
        const w = show ? PLATE : 0.001;
        const h = (cell.sy * w) / Math.max(cell.sx, 0.01);
        dummy.position.set(x, 2.08, z);
        dummy.quaternion.copy(camera.quaternion);
        dummy.scale.set(w, h, 1);
        dummy.updateMatrix();
        inst.setMatrixAt(cell.local, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <EpikEnv />
      <color attach="background" args={["#2a3340"]} />
      <fog attach="fog" args={["#2a3340", 28, 140]} />
      <hemisphereLight args={["#c9d6e6", "#1c1814", 0.85]} />
      <directionalLight position={[-22, 48, 12]} intensity={2.35} color="#ffe2b0" />
      <directionalLight position={[16, 18, 24]} intensity={0.55} color="#9eb6d4" />
      <GodRays />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 10]}>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color="#1a1612" roughness={0.96} metalness={0.02} envMapIntensity={0.15} />
      </mesh>
      <Fortress />
      <group ref={host} />
      {knight && <EpikArmy body={knight.body} helm={knight.helm} />}
      <Arrows />
      <Dust />
      {atlas.sheets.map((sheet, s) => (
        <instancedMesh
          key={s}
          args={[sheet.geometry, sheet.material, Math.max(1, sheet.count)]}
          frustumCulled={false}
          renderOrder={20}
          ref={(node) => {
            sheet.geometry.userData.mesh = node;
          }}
        />
      ))}
    </group>
  );
}

export function EpikCam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const fade = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const shot = epikCam(epikT());
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
    const mesh = fade.current;
    if (!mesh) return;
    mesh.position.copy(camera.position);
    mesh.quaternion.copy(camera.quaternion);
    mesh.translateZ(-1.15);
    (mesh.material as THREE.MeshBasicMaterial).opacity = epikFade(epikT());
  });
  return (
    <mesh ref={fade} renderOrder={50}>
      <planeGeometry args={[4, 8]} />
      <meshBasicMaterial color="#000000" transparent opacity={0} depthTest={false} />
    </mesh>
  );
}
