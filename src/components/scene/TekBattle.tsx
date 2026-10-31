import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import {
  TEK_ARENA,
  TEK_FOES,
  TEK_HERO,
  TEK_RED,
  tekCam,
  tekMarkReady,
  tekReset,
  tekSpot,
  tekT,
  tekTarget,
} from "../../tekReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

const HEIGHT = 1.82;
const ARENA_SCALE = 17;
const ARENA_FLOOR_Y = 0.025;

type RedFight = {
  i: number;
  mix: THREE.AnimationMixer;
  sword: THREE.AnimationAction;
  death: THREE.AnimationAction;
  swordDur: number;
  deathDur: number;
  hold: THREE.Group;
  dead: boolean;
};

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

export function TekBattle() {
  const host = useRef<THREE.Group>(null);
  const hero = useRef<{ mix: THREE.AnimationMixer; dur: number; hold: THREE.Group } | null>(null);
  const reds = useRef<RedFight[]>([]);
  const yaw = useRef(Math.PI);

  useEffect(() => {
    let drop = false;
    tekReset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const [heroFile, redFile, arenaFile] = await Promise.all([
          loadGlb(loader, TEK_HERO),
          loadGlb(loader, TEK_RED),
          loadGlb(loader, TEK_ARENA),
        ]);
        if (drop || !host.current) return;
        const root = host.current;

        const arena = arenaFile.scene;
        arena.scale.setScalar(ARENA_SCALE);
        arena.position.set(0, -ARENA_FLOOR_Y * ARENA_SCALE, 0);
        toLambert(arena);
        root.add(arena);

        toLambert(heroFile.scene);
        fit(heroFile.scene);
        const heroHold = new THREE.Group();
        heroHold.add(heroFile.scene);
        root.add(heroHold);
        const clip = attackClip(heroFile.animations);
        const heroMix = new THREE.AnimationMixer(heroFile.scene);
        if (clip) {
          const action = heroMix.clipAction(clip);
          action.play();
        }
        hero.current = { mix: heroMix, dur: Math.max(0.2, clip?.duration ?? 1), hold: heroHold };

        toLambert(redFile.scene);
        const swordClip = redFile.animations.find((item) => item.name === "Sword_Attack");
        const deathClip = redFile.animations.find((item) => item.name === "Death_B");
        const fights: RedFight[] = [];
        TEK_FOES.forEach((foe, i) => {
          const model = cloneSkinned(redFile.scene) as THREE.Group;
          fit(model);
          const hold = new THREE.Group();
          hold.add(model);
          root.add(hold);
          if (!swordClip || !deathClip) return;
          const mix = new THREE.AnimationMixer(model);
          const sword = mix.clipAction(swordClip);
          sword.loop = THREE.LoopRepeat;
          sword.play();
          const death = mix.clipAction(deathClip);
          death.loop = THREE.LoopOnce;
          death.clampWhenFinished = true;
          fights.push({
            i,
            mix,
            sword,
            death,
            swordDur: swordClip.duration,
            deathDur: deathClip.duration,
            hold,
            dead: false,
          });
        });
        reds.current = fights;
        if (!drop) tekMarkReady();
      } catch (err) {
        console.warn("tek", err);
      }
    })();
    return () => {
      drop = true;
      hero.current?.mix.stopAllAction();
      for (const red of reds.current) red.mix.stopAllAction();
      hero.current = null;
      reds.current = [];
      host.current?.clear();
      tekReset();
    };
  }, []);

  useFrame(() => {
    const t = tekT();
    const man = hero.current;
    if (man) {
      const spot = tekSpot(t < 0.55 ? TEK_FOES[0] : tekTarget(t), t);
      const aim = Math.atan2(spot.z, -spot.x);
      const turn = Math.atan2(Math.sin(aim - yaw.current), Math.cos(aim - yaw.current));
      yaw.current += turn * 0.2;
      man.hold.rotation.y = yaw.current;
      man.mix.setTime((t * 1.15 + 0.55) % man.dur);
    }
    for (const red of reds.current) {
      const foe = TEK_FOES[red.i];
      const spot = tekSpot(foe, t);
      red.hold.position.set(spot.x, 0, spot.z);
      red.hold.rotation.y = spot.yaw;
      if (t < foe.die) {
        if (red.dead) {
          red.death.stop();
          red.sword.reset().play();
          red.dead = false;
        }
        const moving = foe.die > 0 && t < foe.die - (foe.hits === 2 ? 2.05 : 1.05);
        red.mix.setTime(moving ? 0.04 : (t * 0.9 + red.i * 0.17) % red.swordDur);
      } else {
        if (!red.dead) {
          red.sword.stop();
          red.death.reset().play();
          red.dead = true;
        }
        red.mix.setTime(Math.min(red.deathDur - 0.001, t - foe.die));
      }
    }
  });

  return (
    <group>
      <hemisphereLight args={["#f0e2cc", "#6a5844", 1.45]} />
      <directionalLight position={[4, 14, -6]} intensity={1.85} color="#fff2dc" />
      <group ref={host} />
    </group>
  );
}

export function TekCam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const shot = tekCam(tekT());
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
