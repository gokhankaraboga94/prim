import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import {
  RUN_FOES,
  RUN_HERO,
  RUN_RED,
  RUN_SPAN,
  runCam,
  runClip,
  runHeroZ,
  runMarkReady,
  runReset,
  runT,
  runYaw,
} from "../../runReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

const HEIGHT = 1.82;

type RedFight = {
  i: number;
  mix: THREE.AnimationMixer;
  sword: THREE.AnimationAction;
  death: THREE.AnimationAction;
  swordDur: number;
  deathDur: number;
  hold: THREE.Group;
  dead: boolean;
  yaw: number;
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

function inPlace(clip: THREE.AnimationClip) {
  const next = clip.clone();
  next.tracks = clip.tracks.filter((track) => !track.name.includes("Hips.position"));
  return next;
}

function attackClip(clips: THREE.AnimationClip[]) {
  return (
    clips.find((clip) => clip.name.startsWith("The warrior aggressively")) ??
    clips.find((clip) => clip.name.startsWith("The warrior performs")) ??
    clips[0]
  );
}

function Bridge() {
  const length = RUN_SPAN + 14;
  const z = (RUN_SPAN - 14) / 2;
  const posts = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.18, 2.1, 0.18);
    const mat = new THREE.MeshLambertMaterial({ color: "#2a2622" });
    const spots: number[] = [];
    for (let pz = -8; pz < RUN_SPAN; pz += 8) spots.push(pz);
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length * 2);
    const matrix = new THREE.Matrix4();
    spots.forEach((pz, i) => {
      matrix.makeTranslation(-1.22, -1.15, pz);
      mesh.setMatrixAt(i * 2, matrix);
      matrix.makeTranslation(1.22, -1.15, pz);
      mesh.setMatrixAt(i * 2 + 1, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -7.5, z]}>
        <planeGeometry args={[80, length + 40]} />
        <meshLambertMaterial color="#16303c" />
      </mesh>
      <mesh position={[0, -0.1, z]}>
        <boxGeometry args={[2.35, 0.2, length]} />
        <meshLambertMaterial color="#6d6458" />
      </mesh>
      <mesh position={[-1.22, 0.42, z]}>
        <boxGeometry args={[0.1, 0.84, length]} />
        <meshLambertMaterial color="#3a332c" />
      </mesh>
      <mesh position={[1.22, 0.42, z]}>
        <boxGeometry args={[0.1, 0.84, length]} />
        <meshLambertMaterial color="#3a332c" />
      </mesh>
      <primitive object={posts} />
    </group>
  );
}

export function RunBattle() {
  const host = useRef<THREE.Group>(null);
  const hero = useRef<{
    mix: THREE.AnimationMixer;
    run: THREE.AnimationAction;
    atk: THREE.AnimationAction;
    runDur: number;
    hold: THREE.Group;
    mode: "run" | "atk";
  } | null>(null);
  const reds = useRef<RedFight[]>([]);

  useEffect(() => {
    let drop = false;
    runReset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const [heroFile, redFile] = await Promise.all([loadGlb(loader, RUN_HERO), loadGlb(loader, RUN_RED)]);
        if (drop || !host.current) return;
        const root = host.current;

        toLambert(heroFile.scene);
        fit(heroFile.scene);
        const heroHold = new THREE.Group();
        heroHold.add(heroFile.scene);
        root.add(heroHold);
        const runSrc = heroFile.animations.find((clip) => clip.name === "run");
        const atkSrc = attackClip(heroFile.animations);
        const heroMix = new THREE.AnimationMixer(heroFile.scene);
        const runAction = heroMix.clipAction(inPlace(runSrc ?? atkSrc));
        runAction.play();
        const atkAction = heroMix.clipAction(inPlace(atkSrc));
        hero.current = {
          mix: heroMix,
          run: runAction,
          atk: atkAction,
          runDur: Math.max(0.2, runSrc?.duration ?? 1.25),
          hold: heroHold,
          mode: "run",
        };

        toLambert(redFile.scene);
        const swordClip = redFile.animations.find((item) => item.name === "Sword_Attack");
        const deathClip = redFile.animations.find((item) => item.name === "Death_B");
        const fights: RedFight[] = [];
        if (!swordClip || !deathClip) return;
        RUN_FOES.forEach((foe, i) => {
          const model = cloneSkinned(redFile.scene) as THREE.Group;
          fit(model);
          const hold = new THREE.Group();
          hold.position.set(foe.x, 0, foe.z);
          hold.visible = false;
          hold.add(model);
          root.add(hold);
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
            yaw: Math.PI,
          });
        });
        reds.current = fights;
        if (!drop && fights.length === RUN_FOES.length) runMarkReady();
      } catch (err) {
        console.warn("run", err);
      }
    })();
    return () => {
      drop = true;
      hero.current?.mix.stopAllAction();
      for (const red of reds.current) red.mix.stopAllAction();
      hero.current = null;
      reds.current = [];
      host.current?.clear();
      runReset();
    };
  }, []);

  useFrame(() => {
    const now = runT();
    const man = hero.current;
    if (man) {
      const clip = runClip(now);
      man.hold.position.set(0, 0, runHeroZ(now));
      man.hold.rotation.y = runYaw(now);
      if (clip.kind === "run") {
        if (man.mode !== "run") {
          man.atk.stop();
          man.run.reset().play();
          man.mode = "run";
        }
        man.mix.setTime(clip.time % man.runDur);
      } else {
        if (man.mode !== "atk") {
          man.run.stop();
          man.atk.reset().play();
          man.mode = "atk";
        }
        man.mix.setTime(clip.time);
      }
    }
    const hz = runHeroZ(now);
    for (const red of reds.current) {
      const foe = RUN_FOES[red.i];
      const dz = foe.z - hz;
      if (dz > 16 || dz < -8) {
        if (red.hold.visible) red.hold.visible = false;
        continue;
      }
      if (!red.hold.visible) red.hold.visible = true;
      if (now < foe.die) {
        if (red.dead) {
          red.death.stop();
          red.sword.reset().play();
          red.dead = false;
        }
        red.yaw = Math.atan2(-foe.x, hz - foe.z);
        red.hold.rotation.y = red.yaw;
        red.mix.setTime((now * 0.85 + red.i * 0.13) % red.swordDur);
      } else {
        if (!red.dead) {
          red.yaw = Math.atan2(-foe.x, runHeroZ(foe.die) - foe.z);
          red.sword.stop();
          red.death.reset().play();
          red.dead = true;
        }
        red.hold.rotation.y = red.yaw;
        red.mix.setTime(Math.min(red.deathDur - 0.001, now - foe.die));
      }
    }
  });

  return (
    <group>
      <hemisphereLight args={["#d5e4f2", "#3e4a44", 1.35]} />
      <directionalLight position={[4, 12, -6]} intensity={1.7} color="#fff4e4" />
      <Bridge />
      <group ref={host} />
    </group>
  );
}

export function RunCam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const shot = runCam(runT());
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
