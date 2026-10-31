import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { simplifySkinned } from "../../knightSoldier";
import { buildNameAtlas } from "../../nameAtlas";
import {
  TEK3_ARENA,
  TEK3_HERO,
  TEK3_OURS,
  TEK3_PLATE,
  TEK3_RED,
  TEK3_REDS,
  tek3Cam,
  tek3ClipTime,
  tek3Hero,
  tek3MarkReady,
  tek3Reset,
  tek3Roster,
  tek3T,
  tek3Yaw,
} from "../../tek3Reel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

type Hero = {
  i: number;
  hold: THREE.Group;
  mix: THREE.AnimationMixer;
  dur: number;
};

type Red = {
  i: number;
  hold: THREE.Group;
  mix: THREE.AnimationMixer;
  sword: THREE.AnimationAction;
  death: THREE.AnimationAction;
  swordDur: number;
  deathDur: number;
  dead: boolean;
};

const HEIGHT = 1.82;
const ARENA_SCALE = 17;
const ARENA_FLOOR_Y = 0.025;
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

function thin(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const next = simplifySkinned(mesh.geometry, 0.015);
    mesh.geometry.dispose();
    mesh.geometry = next;
  });
}

function fit(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const span = Math.max(0.001, box.max.y - box.min.y);
  const scale = HEIGHT / span;
  root.scale.setScalar(scale);
  root.position.set(
    -((box.min.x + box.max.x) / 2) * scale,
    -box.min.y * scale,
    -((box.min.z + box.max.z) / 2) * scale,
  );
}

function attackClip(clips: THREE.AnimationClip[]) {
  return (
    clips.find((clip) => clip.name.startsWith("The warrior aggressively")) ??
    clips.find((clip) => clip.name.startsWith("The warrior performs")) ??
    clips[0]
  );
}

export function Tek3Battle({ names }: { names: string[] }) {
  const host = useRef<THREE.Group>(null);
  const heroes = useRef<Hero[]>([]);
  const reds = useRef<Red[]>([]);
  const roster = useMemo(() => tek3Roster(names), [names]);
  const named = useMemo(() => roster.map((name, i) => ({ name, i })).filter((row) => row.name), [roster]);
  const atlas = useMemo(
    () =>
      buildNameAtlas(
        named.map((row) => ({ text: row.name, commander: false, plain: false, fill: "#111111", frame: true, plate: "rgba(255,255,255,0.58)" })),
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
    tek3Reset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const [heroFile, redFile, arenaFile] = await Promise.all([
          loadGlb(loader, TEK3_HERO),
          loadGlb(loader, TEK3_RED),
          loadGlb(loader, TEK3_ARENA),
        ]);
        if (drop || !host.current) return;
        const root = host.current;

        const ground = arenaFile.scene;
        ground.scale.setScalar(ARENA_SCALE);
        ground.position.set(0, -ARENA_FLOOR_Y * ARENA_SCALE, 0);
        toLambert(ground);
        root.add(ground);

        toLambert(heroFile.scene);
        fit(heroFile.scene);
        const clip = attackClip(heroFile.animations);
        if (!clip) return;
        const ours: Hero[] = [];
        for (let i = 0; i < TEK3_OURS; i++) {
          const body = i === 0 ? heroFile.scene : cloneSkinned(heroFile.scene);
          const hold = new THREE.Group();
          hold.add(body);
          root.add(hold);
          const mix = new THREE.AnimationMixer(body);
          const action = mix.clipAction(clip);
          action.play();
          ours.push({ i, hold, mix, dur: clip.duration });
        }

        toLambert(redFile.scene);
        thin(redFile.scene);
        const swordClip = redFile.animations.find((item) => item.name === "Sword_Attack");
        const deathClip = redFile.animations.find((item) => item.name === "Death_B");
        if (!swordClip || !deathClip) return;
        const foes: Red[] = [];
        TEK3_REDS.forEach((_, i) => {
          const model = cloneSkinned(redFile.scene) as THREE.Group;
          fit(model);
          const hold = new THREE.Group();
          hold.add(model);
          root.add(hold);
          const mix = new THREE.AnimationMixer(model);
          const sword = mix.clipAction(swordClip);
          sword.loop = THREE.LoopRepeat;
          sword.play();
          const death = mix.clipAction(deathClip);
          death.loop = THREE.LoopOnce;
          death.clampWhenFinished = true;
          foes.push({
            i,
            hold,
            mix,
            sword,
            death,
            swordDur: swordClip.duration,
            deathDur: deathClip.duration,
            dead: false,
          });
        });
        if (drop) return;
        heroes.current = ours;
        reds.current = foes;
        tek3MarkReady();
      } catch (err) {
        console.warn("tek3", err);
      }
    })();
    return () => {
      drop = true;
      for (const man of heroes.current) man.mix.stopAllAction();
      for (const man of reds.current) man.mix.stopAllAction();
      heroes.current = [];
      reds.current = [];
      host.current?.clear();
      tek3Reset();
    };
  }, []);

  useFrame(({ camera }) => {
    const now = tek3T();
    for (const man of heroes.current) {
      const spot = tek3Hero(man.i);
      man.hold.position.set(spot.x, 0, spot.z);
      man.hold.rotation.y = tek3Yaw(man.i, now);
      man.mix.setTime(tek3ClipTime(now) % man.dur);
    }
    for (const man of reds.current) {
      const spot = TEK3_REDS[man.i];
      man.hold.position.set(spot.x, 0, spot.z);
      man.hold.rotation.y = spot.yaw;
      if (now < spot.die) {
        if (man.dead) {
          man.death.stop();
          man.sword.reset().play();
          man.dead = false;
        }
        man.mix.setTime((now * 0.9 + man.i * 0.13) % man.swordDur);
      } else {
        if (!man.dead) {
          man.sword.stop();
          man.death.reset().play();
          man.dead = true;
        }
        man.mix.setTime(Math.min(man.deathDur - 0.001, now - spot.die));
      }
    }
    for (const sheet of atlas.sheets) {
      const inst = sheet.geometry.userData.mesh as THREE.InstancedMesh | undefined;
      if (!inst) continue;
      for (let n = 0; n < named.length; n++) {
        const cell = atlas.cells[n];
        if (!cell || cell.sheet !== atlas.sheets.indexOf(sheet)) continue;
        const spot = tek3Hero(named[n].i);
        const w = TEK3_PLATE;
        const h = (cell.sy * w) / Math.max(cell.sx, 0.01);
        dummy.position.set(spot.x, 2.35, spot.z);
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
      <hemisphereLight args={["#f0e2cc", "#6a5844", 1.45]} />
      <directionalLight position={[4, 14, -6]} intensity={1.85} color="#fff2dc" />
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

export function Tek3Cam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const shot = tek3Cam(tek3T());
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
