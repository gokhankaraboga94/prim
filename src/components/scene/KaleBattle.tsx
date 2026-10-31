import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { buildNameAtlas } from "../../nameAtlas";
import { Castle } from "./Castle";
import {
  KALE_HERO,
  KALE_OURS,
  KALE_PLATE,
  KALE_ROMAN,
  KALE_ROMANS,
  kaleCam,
  kaleDoor,
  kaleMarkReady,
  kalePosts,
  kaleReset,
  kaleRoman,
  kaleRoster,
  kaleShake,
  kaleT,
} from "../../kaleReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

const HERO_H = 1.82;
const ROMAN_H = 1.72;
const dummy = new THREE.Object3D();

function loadGlb(loader: GLTFLoader, url: string) {
  const buf = preloadedGlb(url);
  return new Promise<Gltf>((ok, fail) => {
    if (buf) loader.parse(buf.slice(0), "", ok, fail);
    else loader.load(url, ok, undefined, fail);
  });
}

function toLambert(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    mesh.material = new THREE.MeshLambertMaterial({
      map: src.map ?? null,
      color: src.color ? src.color.clone() : "#ffffff",
    });
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
  });
}

function fitHero(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const span = Math.max(0.001, box.max.y - box.min.y);
  const scale = HERO_H / span;
  root.scale.setScalar(scale);
  root.position.set(
    -((box.min.x + box.max.x) / 2) * scale,
    -box.min.y * scale,
    -((box.min.z + box.max.z) / 2) * scale,
  );
}

function romanGeometry(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.geometry.clone();
    src.applyMatrix4(mesh.matrixWorld);
    src.computeBoundingBox();
    const box = src.boundingBox;
    if (!box) return;
    const size = box.getSize(new THREE.Vector3());
    const wide = Math.max(size.x, size.z);
    if (size.y < 0.03 || (size.y < wide * 0.2 && size.y < 0.05)) {
      src.dispose();
      return;
    }
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    const color = mat?.color ? mat.color.clone() : new THREE.Color("#c4b49a");
    const pos = src.getAttribute("position");
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", pos.clone());
    next.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    src.dispose();
    parts.push(next);
  });
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) return null;
  merged.computeBoundingBox();
  const box = merged.boundingBox;
  if (!box) return merged;
  const span = Math.max(0.001, box.max.y - box.min.y);
  const scale = ROMAN_H / span;
  merged.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  merged.scale(scale, scale, scale);
  return merged;
}

function guardClip(clips: THREE.AnimationClip[]) {
  return (
    clips.find((clip) => clip.name.startsWith("The warrior assumes")) ??
    clips.find((clip) => clip.name.startsWith("The warrior aggressively")) ??
    clips[0]
  );
}

export function KaleBattle({ names, level }: { names: string[]; level: number }) {
  const host = useRef<THREE.Group>(null);
  const romans = useRef<THREE.InstancedMesh | null>(null);
  const shake = useRef({ current: 0 });
  const posts = useMemo(() => kalePosts(level), [level]);
  const door = useMemo(() => kaleDoor(level), [level]);
  const roster = useMemo(() => kaleRoster(names), [names]);
  const named = useMemo(() => roster.map((name, i) => ({ name, i })).filter((row) => row.name), [roster]);
  const atlas = useMemo(
    () =>
      buildNameAtlas(
        named.map((row) => ({ text: row.name, commander: false, plain: false, fill: "#111111", frame: true, plate: "rgba(255,255,255,0.86)" })),
        true,
        false,
      ),
    [named],
  );

  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    void (async () => {
      try {
        const [heroGltf, romanGltf] = await Promise.all([loadGlb(loader, KALE_HERO), loadGlb(loader, KALE_ROMAN)]);
        if (drop || !host.current) return;
        const clip = guardClip(heroGltf.animations);
        toLambert(heroGltf.scene);
        fitHero(heroGltf.scene);
        for (let i = 0; i < KALE_OURS; i++) {
          const spot = posts[i];
          if (!spot) continue;
          const model = cloneSkinned(heroGltf.scene);
          const hold = new THREE.Group();
          hold.position.set(spot.x, spot.y, spot.z);
          hold.rotation.y = spot.yaw;
          hold.add(model);
          const mix = new THREE.AnimationMixer(model);
          const action = mix.clipAction(clip);
          action.play();
          mix.setTime(2);
          host.current.add(hold);
        }
        const geo = romanGeometry(romanGltf.scene);
        if (!geo || drop || !host.current) return;
        const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
        const mesh = new THREE.InstancedMesh(geo, mat, KALE_ROMANS);
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        for (let i = 0; i < KALE_ROMANS; i++) {
          const spot = kaleRoman(i, 0, door);
          dummy.position.set(spot.x, 0, spot.z);
          dummy.rotation.set(0, Math.PI, 0);
          dummy.scale.setScalar(spot.s);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        host.current.add(mesh);
        romans.current = mesh;
        if (drop) return;
        kaleMarkReady();
      } catch (err) {
        console.warn("kale", err);
      }
    })();
    return () => {
      drop = true;
      romans.current = null;
      host.current?.clear();
      kaleReset();
    };
  }, [door, posts]);

  useFrame(({ camera }) => {
    const now = kaleT();
    shake.current.current = kaleShake(now);
    const mesh = romans.current;
    if (mesh) {
      for (let i = 0; i < KALE_ROMANS; i++) {
        const spot = kaleRoman(i, now, door);
        dummy.position.set(spot.x, 0, spot.z);
        dummy.rotation.set(0, Math.PI, 0);
        dummy.scale.setScalar(spot.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const sheet of atlas.sheets) {
      const inst = sheet.geometry.userData.mesh as THREE.InstancedMesh | undefined;
      if (!inst) continue;
      for (let n = 0; n < named.length; n++) {
        const cell = atlas.cells[n];
        if (!cell || cell.sheet !== atlas.sheets.indexOf(sheet)) continue;
        const spot = posts[named[n].i];
        if (!spot) continue;
        const w = KALE_PLATE;
        const h = (cell.sy * w) / Math.max(cell.sx, 0.01);
        dummy.position.set(spot.x, spot.y + 2.45, spot.z);
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
      <Castle level={level} pressure={0} gateClosed defenders={false} gateBreak={shake.current} />
      <group ref={host} />
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

export function KaleCam({ level }: { level: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const shot = kaleCam(kaleT(), level);
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
