import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { preloadedGlb, releasePreloadedGlbs } from "../../arenaPreload";
import { buildNameAtlas } from "../../nameAtlas";
import {
  DANCE_MEKAN,
  DANCE_MEKAN_SPAN,
  DANCE_MODELS,
  DANCE_N,
  DANCE_STREET_FEET,
  danceCam,
  danceIsPhone,
  danceMarkReady,
  danceReset,
  danceResetCamTarget,
  danceRoster,
  danceSetCamTarget,
  danceSpot,
  danceT,
} from "../../danceReel";
import { Dance2Club } from "./Dance2Club";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

type FinishedEv = { action?: THREE.AnimationAction };
type Dancer = {
  i: number;
  host: THREE.Group;
  mix: THREE.AnimationMixer;
  clips: THREE.AnimationClip[];
  index: number;
  offFinished: ((ev: FinishedEv) => void) | null;
};

const HEIGHT = 1.55;
const dummy = new THREE.Object3D();
/** Average street Y under the dancers — camera follows this lift. */
let streetLift = 0;

function loadGlb(loader: GLTFLoader, url: string) {
  const buf = preloadedGlb(url);
  return new Promise<Gltf>((ok, fail) => {
    if (buf) {
      const mag = new TextDecoder("ascii").decode(new Uint8Array(buf, 0, Math.min(4, buf.byteLength)));
      if (mag !== "glTF") {
        fail(new Error(`${url}: önbellekte HTML/bozuk yanıt (GLB değil)`));
        return;
      }
      loader.parse(buf.slice(0), "", ok, fail);
      return;
    }
    loader.load(url, ok, undefined, fail);
  });
}

function toLambert(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    const next = new THREE.MeshLambertMaterial({
      map: src?.map ?? null,
      color: src?.color ? src.color.clone() : new THREE.Color("#ffffff"),
    });
    if (src?.map) src.map = null;
    src?.normalMap?.dispose();
    src?.roughnessMap?.dispose();
    src?.metalnessMap?.dispose();
    src?.dispose?.();
    mesh.material = next;
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

/** Seat venue on y=0, center XZ — span must match DANCE_STREET_FEET bake. */
function fitMekan(root: THREE.Object3D, targetSpan = DANCE_MEKAN_SPAN) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const sx = Math.max(0.001, box.max.x - box.min.x);
  const sz = Math.max(0.001, box.max.z - box.min.z);
  const span = Math.max(sx, sz);
  const scale = targetSpan / span;
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  const next = new THREE.Box3().setFromObject(root);
  root.position.x -= (next.min.x + next.max.x) / 2;
  root.position.z -= (next.min.z + next.max.z) / 2;
  root.position.y -= next.min.y;
  root.updateMatrixWorld(true);
}

/** Snap figure soles to one deck — kills model/pose foot drift. */
function plantOnDeck(holder: THREE.Object3D, deckTop: number) {
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  if (!Number.isFinite(box.min.y)) return;
  holder.position.y += deckTop - box.min.y;
  holder.updateMatrixWorld(true);
}

/** Prefer dance-named clips; otherwise keep all clips in file order (1–3 dances). */
function danceClips(clips: THREE.AnimationClip[]) {
  if (!clips.length) return [] as THREE.AnimationClip[];
  const named = clips.filter((c) => /dance|dans|mixamo|hip.?hop|groove|move|take/i.test(c.name));
  const list = named.length ? named : clips.slice();
  return list.filter((c) => c.duration > 0.05);
}

/** Phone fallback when mekan.glb OOMs — dark plaza so dance1 still records. */
function buildStreetFallback(parent: THREE.Group, deckTop: number) {
  const under = new THREE.Mesh(
    new THREE.CircleGeometry(80, 48),
    new THREE.MeshLambertMaterial({ color: "#12141a" }),
  );
  under.rotation.x = -Math.PI / 2;
  under.position.y = -0.08;
  parent.add(under);
  const padH = 0.14;
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(18, padH, 12),
    new THREE.MeshLambertMaterial({ color: "#3a3a3e" }),
  );
  pad.position.set(0, deckTop - padH / 2, -1.1);
  parent.add(pad);
  const curb = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.35, 0.4),
    new THREE.MeshLambertMaterial({ color: "#2a2c32" }),
  );
  curb.position.set(0, deckTop + 0.1, -5.2);
  parent.add(curb);
  for (const side of [-1, 1] as const) {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 6.5, 3.2),
      new THREE.MeshLambertMaterial({ color: "#1c1e24" }),
    );
    block.position.set(side * 9.5, deckTop + 3.2, -8);
    parent.add(block);
  }
}

function playClip(man: Dancer, at: number) {
  if (!man.clips.length) return;
  if (man.offFinished) {
    man.mix.removeEventListener("finished", man.offFinished);
    man.offFinished = null;
  }
  man.mix.stopAllAction();
  man.index = ((at % man.clips.length) + man.clips.length) % man.clips.length;
  const clip = man.clips[man.index];
  const action = man.mix.clipAction(clip);
  action.reset();
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const onDone = (ev: FinishedEv) => {
    if (ev.action !== action) return;
    man.mix.removeEventListener("finished", onDone as unknown as (e: object) => void);
    man.offFinished = null;
    playClip(man, man.index + 1);
  };
  man.offFinished = onDone;
  man.mix.addEventListener("finished", onDone as unknown as (e: object) => void);
}

export function DanceBattle({ names, mekan = true }: { names: string[]; mekan?: boolean }) {
  const host = useRef<THREE.Group>(null);
  const floor = useRef<THREE.Group>(null);
  const pack = useRef<Dancer[]>([]);
  const camera = useThree((s) => s.camera);
  const phone = useMemo(() => danceIsPhone(), []);
  const roster = useMemo(() => danceRoster(names), [names]);
  const named = useMemo(() => roster.map((name, i) => ({ name, i })).filter((row) => row.name), [roster]);
  const atlas = useMemo(
    () =>
      buildNameAtlas(
        named.map((row) => ({
          text: row.name,
          commander: false,
          plain: false,
          fill: "#111111",
          frame: true,
          plate: "#ffffff",
        })),
        true,
        true,
      ),
    [named],
  );

  useEffect(() => {
    for (const sheet of atlas.sheets) sheet.material.depthTest = false;
    return () => atlas.dispose();
  }, [atlas]);

  useEffect(() => {
    let drop = false;
    danceReset();
    danceResetCamTarget();
    streetLift = 0;
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const files: Gltf[] = [];
        for (const url of DANCE_MODELS) {
          const gltf = await loadGlb(loader, url);
          if (drop) return;
          files.push(gltf);
        }
        if (files.length < DANCE_MODELS.length) {
          throw new Error("dans modelleri eksik");
        }

        for (const gltf of files) {
          toLambert(gltf.scene);
          fit(gltf.scene);
        }
        // Free dancer GLB buffers after parse — phones need headroom before skins + venue.
        releasePreloadedGlbs(DANCE_MODELS);

        // Street pack stands on a flat stage at world origin — not on uneven GLB mesh.
        const packCx = DANCE_STREET_FEET.reduce((s, f) => s + f.x, 0) / DANCE_N;
        const packCz = DANCE_STREET_FEET.reduce((s, f) => s + f.z, 0) / DANCE_N;
        const streetY = DANCE_STREET_FEET[0]?.y ?? 0;
        // Stage top at y=0; bury mekan street/props under it so nothing clips legs.
        const deckTop = 0;
        if (mekan) {
          floor.current?.clear();
          let venueOk = false;
          try {
            const venue = await loadGlb(loader, DANCE_MEKAN);
            if (drop) return;
            toLambert(venue.scene);
            fitMekan(venue.scene, DANCE_MEKAN_SPAN);
            // Plaza under origin for backdrop; sink street below the flat stage.
            venue.scene.position.x -= packCx;
            venue.scene.position.z -= packCz;
            venue.scene.position.y -= streetY + 0.85;
            venue.scene.updateMatrixWorld(true);
            floor.current?.add(venue.scene);
            const padH = 0.22;
            const pad = new THREE.Mesh(
              new THREE.BoxGeometry(20, padH, 14),
              new THREE.MeshLambertMaterial({ color: "#3a3c42" }),
            );
            pad.position.set(0, deckTop - padH / 2, -0.4);
            pad.receiveShadow = false;
            floor.current?.add(pad);
            const under = new THREE.Mesh(
              new THREE.CircleGeometry(phone ? 48 : 80, phone ? 40 : 64),
              new THREE.MeshLambertMaterial({ color: "#12141a" }),
            );
            under.rotation.x = -Math.PI / 2;
            under.position.y = -0.95;
            floor.current?.add(under);
            venueOk = true;
          } catch (err) {
            console.warn("dance mekan", err);
            if (phone && floor.current) {
              buildStreetFallback(floor.current, deckTop);
              venueOk = true;
            }
          }
          releasePreloadedGlbs([DANCE_MEKAN]);
          if (!venueOk) throw new Error("mekan yüklenemedi");
          floor.current?.updateMatrixWorld(true);
        } else {
          floor.current?.clear();
        }

        const root = host.current;
        if (!root) throw new Error("dans sahne kökü yok");
        const men: Dancer[] = [];
        for (let i = 0; i < DANCE_N; i++) {
          const source = files[i % files.length];
          const body = cloneSkinned(source.scene) as THREE.Group;
          const holder = new THREE.Group();
          holder.add(body);
          const spot = danceSpot(i);
          // Same flat grid as dance2 — no per-foot GLB heights.
          holder.position.set(spot.x, deckTop, spot.z);
          holder.rotation.y = Math.PI;
          const mix = new THREE.AnimationMixer(body);
          const clips = danceClips(source.animations);
          const man: Dancer = { i, host: holder, mix, clips, index: 0, offFinished: null };
          if (clips.length) {
            playClip(man, i % clips.length);
            mix.update(0);
          }
          plantOnDeck(holder, deckTop);
          root.add(holder);
          men.push(man);
        }
        if (drop) return;
        if (men.length < DANCE_N) throw new Error("dans sahne eksik");
        if (mekan && !floor.current?.children.length) throw new Error("mekan yüklenemedi");
        pack.current = men;
        streetLift = deckTop;
        const cx = men.reduce((s, m) => s + m.host.position.x, 0) / men.length;
        const cz = men.reduce((s, m) => s + m.host.position.z, 0) / men.length;
        danceSetCamTarget(cx, cz, mekan ? "street" : "club");
        await new Promise<void>((ok) => requestAnimationFrame(() => ok()));
        if (drop) return;
        danceMarkReady();
      } catch (err) {
        console.warn("dance", err);
      }
    })();
    return () => {
      drop = true;
      streetLift = 0;
      danceResetCamTarget();
      for (const man of pack.current) {
        if (man.offFinished) {
          man.mix.removeEventListener("finished", man.offFinished as unknown as (e: object) => void);
        }
        man.mix.stopAllAction();
      }
      pack.current = [];
      host.current?.clear();
      floor.current?.clear();
      danceReset();
    };
  }, [mekan, phone]);

  useFrame((_, dt) => {
    const t = danceT();
    for (const man of pack.current) {
      if (t > 0) man.mix.update(dt);
    }
    for (const sheet of atlas.sheets) {
      const inst = sheet.geometry.userData.mesh as THREE.InstancedMesh | undefined;
      if (!inst) continue;
      const sheetIndex = atlas.sheets.indexOf(sheet);
      for (let n = 0; n < named.length; n++) {
        const cell = atlas.cells[n];
        if (!cell || cell.sheet !== sheetIndex) continue;
        const man = pack.current.find((m) => m.i === named[n].i);
        const idx = named[n].i;
        const px = man?.host.position.x ?? danceSpot(idx).x;
        const pz = man?.host.position.z ?? danceSpot(idx).z;
        const foot = man?.host.position.y ?? 0;
        const row = Math.floor(idx / 5);
        const col = idx % 5;
        // Stagger plates by row + slight col offset so names stay readable in orbit
        // dance2: names 20% lower — head-to-plate gap was too wide
        const lift = (2.15 + row * 0.35 + (col % 2) * 0.12) * (mekan ? 1 : 0.8);
        const headY = foot + lift;
        const dx = px - camera.position.x;
        const dy = headY - camera.position.y;
        const dz = pz - camera.position.z;
        const dist = Math.hypot(dx, dy, dz);
        const base = Math.min(0.52, 0.24 + dist * 0.011);
        const w = base * 1.45;
        const h = (cell.sy * w) / Math.max(cell.sx, 0.01);
        dummy.position.set(px, headY, pz);
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
      {mekan ? (
        <>
          <hemisphereLight args={["#ffffff", "#d0d0d0", phone ? 1.2 : 1.35]} />
          <directionalLight position={[4, 12, 6]} intensity={phone ? 1.35 : 1.55} color="#ffffff" />
        </>
      ) : (
        <Dance2Club lite={phone} />
      )}
      <group ref={floor} />
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

export function DanceCam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const shot = danceCam(danceT());
    const lift = streetLift;
    camera.position.set(shot.x, shot.y + lift, shot.z);
    camera.lookAt(shot.lx, shot.ly + lift, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
