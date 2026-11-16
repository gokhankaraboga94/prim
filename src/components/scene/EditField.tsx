import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { TEAMS, characterById, type GroundId } from "../../edit/catalog";
import { moveSelected, selectNearby, stepUnits, teamLabel, type EditStore, type Unit } from "../../edit/battle";
import type { CharacterAsset } from "../../edit/loadModel";
import { MAX_PER_MODEL } from "../../edit/catalog";
import { reelWindow } from "../../recordCanvas";

const teamColor = new Map<number, THREE.Color>(TEAMS.map((team) => [team.id, new THREE.Color(team.color)]));
const white = new THREE.Color("#ffffff");
const gold = new THREE.Color("#ffe08a");
const goldHot = new THREE.Color("#fff7c2");
const dummy = new THREE.Object3D();
const UP = new THREE.Vector3(0, 1, 0);
const sideAxis = new THREE.Vector3();
const qYaw = new THREE.Quaternion();
const qPitch = new THREE.Quaternion();
const tint = new THREE.Color();
const aim = new THREE.Vector3();
const ndc = new THREE.Vector2();
const hit = new THREE.Vector3();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const nameCache = new Map<string, THREE.Texture>();
const NAME_PX = 128;
const NAME_H = 192;
const NAME_FONT = `700 ${NAME_PX}px Outfit, "Segoe UI", sans-serif`;

/**
 * One texture per label, drawn at 128 px glyph height on a canvas sized to the
 * text, so the sprite can be scaled to the same aspect and never stretches the
 * glyphs. Max anisotropy keeps it legible at the grazing camera angle.
 */
function nameTexture(text: string, anisotropy: number) {
  const cached = nameCache.get(text);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  const probe = canvas.getContext("2d");
  if (!probe) return null;
  probe.font = NAME_FONT;
  const pad = 36;
  const textW = Math.ceil(probe.measureText(text).width);
  canvas.width = Math.min(2048, Math.max(256, textW + pad * 2));
  canvas.height = NAME_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = NAME_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 22;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(text, canvas.width / 2, NAME_H / 2 + 6, canvas.width - pad);
  ctx.fillStyle = "#f6e7b2";
  ctx.fillText(text, canvas.width / 2, NAME_H / 2 + 6, canvas.width - pad);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.userData.aspect = canvas.width / canvas.height;
  nameCache.set(text, tex);
  return tex;
}

function groundTexture(id: GroundId) {
  const canvas = document.createElement("canvas");
  const phone = typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 860;
  const size = phone ? 512 : 1024;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const baseFixed = id === "asphalt" ? "#7a8490" : id === "dirt" ? "#b08a55" : id === "stone" ? "#a8b0b8" : "#6ec84a";
  ctx.fillStyle = baseFixed;
  ctx.fillRect(0, 0, size, size);
  // Hafif parlak örtü
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(0, 0, size, size);
  const specks = phone ? 1800 : 7000;
  for (let i = 0; i < specks; i++) {
    if (id === "grass") {
      const n = i % 7;
      ctx.fillStyle = n === 0 ? "#a8e878" : n === 1 ? "#5aaa38" : n === 2 ? "#88d060" : n === 3 ? "#4a9830" : n === 4 ? "#b8f088" : n === 5 ? "#78c850" : "#3e8828";
    } else if (id === "asphalt") {
      ctx.fillStyle = i % 3 === 0 ? "#9aa4b0" : i % 3 === 1 ? "#6a7480" : "#8a949e";
    } else if (id === "dirt") {
      ctx.fillStyle = i % 3 === 0 ? "#c8a06a" : i % 3 === 1 ? "#9a7848" : "#b89860";
    } else {
      ctx.fillStyle = i % 3 === 0 ? "#c8d0d8" : i % 3 === 1 ? "#9098a0" : "#b0b8c0";
    }
    ctx.fillRect(Math.random() * size, Math.random() * size, 2 + Math.random() * 7, 2 + Math.random() * 6);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(id === "asphalt" ? 8 : 12, id === "asphalt" ? 8 : 12);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function findBone(root: THREE.Object3D, names: string[]): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (found) return;
    if (names.some((n) => obj.name === n || obj.name.endsWith(n))) found = obj;
  });
  return found;
}

function attachEditGun(root: THREE.Object3D, pistol: boolean) {
  const hand = findBone(root, ["mixamorig:RightHand", "RightHand", "mixamorig_RightHand"]);
  if (!hand) return;
  const g = new THREE.Group();
  const steel = new THREE.MeshLambertMaterial({ color: "#c5ccd4" });
  if (pistol) {
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.085, 0.18), steel);
    slide.position.set(0, 0.02, 0.06);
    g.add(slide);
    g.scale.setScalar(1.05);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.28), steel);
    body.position.set(0, 0.02, 0.08);
    g.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.32, 6), steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, 0.3);
    g.add(barrel);
    g.scale.setScalar(0.92);
  }
  g.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  g.position.set(0.02, 0.06, 0.04);
  hand.add(g);
}

function placeUnit(unit: Unit) {
  const reach = Math.sin(unit.swing * Math.PI);
  const len = Math.hypot(unit.aimX, unit.aimZ) || 1;
  const lunge = reach * Math.min(0.45, unit.radius * 0.28);
  dummy.position.set(unit.x + (unit.aimX / len) * lunge, unit.y, unit.z + (unit.aimZ / len) * lunge);
  // Pitch about the model's own side axis (its local forward is rotated by -yawOffset), then yaw in the world.
  // A lunge nods and a death falls forward for every model, whichever axis it was authored along.
  const fx = Math.sin(-unit.yawOffset);
  const fz = Math.cos(-unit.yawOffset);
  sideAxis.set(fz, 0, -fx);
  qPitch.setFromAxisAngle(sideAxis, unit.pitch + reach * 0.5);
  qYaw.setFromAxisAngle(UP, unit.yaw);
  dummy.quaternion.copy(qYaw).multiply(qPitch);
  dummy.scale.setScalar(unit.alive || unit.fall < 1 ? 1 : 0.001);
  dummy.updateMatrix();
}

function clipBy(clips: THREE.AnimationClip[], keys: string[]) {
  for (const key of keys) {
    const hit = clips.find((clip) => clip.name.toLowerCase().includes(key));
    if (hit) return hit;
  }
  return null;
}

type Actor = {
  id: number;
  holder: THREE.Group;
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction | null;
  move: THREE.AnimationAction | null;
  attack: THREE.AnimationAction | null;
  fireWalk: THREE.AnimationAction | null;
  current: THREE.AnimationAction | null;
  mode: string;
  px: number;
  pz: number;
};

function makeActor(asset: CharacterAsset): Omit<Actor, "id"> {
  const holder = new THREE.Group();
  const model = cloneSkinned(asset.template!) as THREE.Object3D;
  holder.add(model);
  const def = characterById(asset.id);
  if (def?.gun) attachEditGun(model, !/1|3|5|7|9/.test(asset.id.slice(-1)));
  const mixer = new THREE.AnimationMixer(model);
  const clips = asset.clips ?? [];
  const play = (clip: THREE.AnimationClip | null) => {
    if (!clip) return null;
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    return action;
  };
  const fireStand =
    clips.find((c) => c.name === "fire" || c.name === "silah ile ateş ediyor") ??
    clips.find((c) => /fire|ateş|silah/i.test(c.name) && !/koş|kos|run|walk/i.test(c.name)) ??
    null;
  const fireRun =
    clips.find((c) => c.name === "silah ile ateş ediyor koşarken") ??
    clips.find((c) => /ateş|fire|silah/i.test(c.name) && /koş|kos|run|walk/i.test(c.name)) ??
    null;
  const walk = clipBy(clips, ["walk", "run", "sprint"]);
  const idle = play(clipBy(clips, ["idle", "defensive", "stance"])) ?? play(fireStand) ?? play(clips[0] ?? null);
  const move = play(walk);
  const attack = play(fireStand) ?? play(clipBy(clips, ["aggress", "sword", "attack", "combo", "fire", "ateş"]));
  const fireWalk = play(fireRun) ?? attack;
  idle?.play();
  return { holder, mixer, idle, move, attack, fireWalk, current: idle, mode: "idle", px: 0, pz: 0 };
}

function EditRig({ store, assets }: { store: EditStore; assets: Record<string, CharacterAsset> }) {
  const { camera, gl } = useThree();
  const bodies = useRef<THREE.Group>(null);
  const rings = useRef<THREE.InstancedMesh>(null);
  const bars = useRef<THREE.InstancedMesh>(null);
  const bolts = useRef<THREE.InstancedMesh>(null);
  const names = useRef<THREE.Group>(null);
  const maxAniso = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);
  const meshes = useRef(new Map<string, THREE.InstancedMesh>());
  const actors = useRef(new Map<number, Actor>());
  const keys = useRef(new Set<string>());
  const look = useRef({ yaw: 0.45, pitch: 0.78, dist: 38 });
  const drag = useRef<{ x: number; y: number; button: number; moved: boolean; sx: number; sy: number; touch: boolean } | null>(null);
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.78, 1, 28), []);
  const barGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }), []);
  const barMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95, depthTest: false }), []);

  useEffect(() => {
    const host = bodies.current;
    if (!host) return;
    for (const [id, asset] of Object.entries(assets)) {
      if (asset.template || meshes.current.has(id)) continue;
      const mesh = new THREE.InstancedMesh(asset.geometry, asset.material, MAX_PER_MODEL);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      host.add(mesh);
      meshes.current.set(id, mesh);
    }
  }, [assets]);

  useEffect(() => {
    const pool = meshes.current;
    const cast = actors.current;
    return () => {
      // Geometry and material belong to the asset; only the instance buffers go here.
      for (const mesh of pool.values()) mesh.dispose();
      pool.clear();
      for (const actor of cast.values()) {
        actor.holder.removeFromParent();
        actor.mixer.stopAllAction();
      }
      cast.clear();
    };
  }, []);

  useEffect(() => {
    const keysRef = keys.current;
    const down = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const rec = ["KeyQ", "KeyE", "KeyR", "KeyF", "Equal", "Minus", "NumpadAdd", "NumpadSubtract"].includes(event.code);
      if (!event.key.startsWith("Arrow") && !rec) return;
      event.preventDefault();
      keysRef.add(event.code.startsWith("Key") || event.code.startsWith("Numpad") || event.code === "Equal" || event.code === "Minus" ? event.code : event.key);
    };
    const up = (event: KeyboardEvent) => {
      keysRef.delete(event.key);
      keysRef.delete(event.code);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    const finishBox = (event: PointerEvent) => {
      const box = drag.current;
      drag.current = null;
      if (!box || box.button !== 0 || !box.moved) return;
      const left = Math.min(box.sx, event.clientX);
      const right = Math.max(box.sx, event.clientX);
      const top = Math.min(box.sy, event.clientY);
      const bottom = Math.max(box.sy, event.clientY);
      const rect = canvas.getBoundingClientRect();
      if (!event.shiftKey) store.selected.clear();
      for (const unit of store.units) {
        if (!unit.alive) continue;
        aim.set(unit.x, unit.height * 0.55, unit.z).project(camera);
        if (aim.z > 1) continue;
        const sx = (aim.x * 0.5 + 0.5) * rect.width + rect.left;
        const sy = (-aim.y * 0.5 + 0.5) * rect.height + rect.top;
        if (sx >= left && sx <= right && sy >= top && sy <= bottom) store.selected.add(unit.id);
      }
      store.note = store.selected.size ? `${store.selected.size} asker seçildi.` : "Seçim boş.";
      store.bump();
    };
    const hideMarquee = () => {
      const mark = document.getElementById("edit-marquee");
      if (mark) mark.style.display = "none";
    };
    const panView = (dx: number, dy: number) => {
      const e = camera.matrixWorld.elements;
      const rx = e[0];
      const rz = e[2];
      const fx = -e[8];
      const fz = -e[10];
      const scale = look.current.dist * 0.0016;
      store.viewX -= (rx * dx + fx * dy) * scale;
      store.viewZ -= (rz * dx + fz * dy) * scale;
    };
    // Touch: one finger taps and box-selects like the mouse; two fingers pinch to zoom and drag to pan.
    const fingers = new Map<number, { x: number; y: number }>();
    let pinch: { dist: number; cx: number; cy: number } | null = null;
    let pinched = false;
    const fingerPair = () => {
      const [a, b] = [...fingers.values()];
      return { dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        canvas.setPointerCapture(event.pointerId);
        if (fingers.size >= 2) {
          drag.current = null;
          hideMarquee();
          pinch = fingerPair();
          pinched = true;
          return;
        }
        drag.current = { x: event.clientX, y: event.clientY, button: 2, moved: false, sx: event.clientX, sy: event.clientY, touch: true };
        return;
      }
      if (event.button === 0 || event.button === 1 || event.button === 2) {
        drag.current = { x: event.clientX, y: event.clientY, button: event.button, moved: false, sx: event.clientX, sy: event.clientY, touch: false };
        canvas.setPointerCapture(event.pointerId);
      }
    };
    const onMove = (event: PointerEvent) => {
      if (fingers.has(event.pointerId)) {
        fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (fingers.size >= 2 && pinch) {
          const next = fingerPair();
          look.current.dist = Math.max(5, Math.min(170, (look.current.dist * pinch.dist) / next.dist));
          panView(next.cx - pinch.cx, next.cy - pinch.cy);
          pinch = next;
          return;
        }
      }
      const box = drag.current;
      if (!box) return;
      const dx = event.clientX - box.x;
      const dy = event.clientY - box.y;
      if (Math.hypot(event.clientX - box.sx, event.clientY - box.sy) > 6) box.moved = true;
      box.x = event.clientX;
      box.y = event.clientY;
      if (box.button === 2) {
        look.current.yaw -= dx * 0.005;
        look.current.pitch = Math.max(0.12, Math.min(1.32, look.current.pitch + dy * 0.004));
      } else if (box.button === 1) {
        panView(dx, dy);
      } else if (box.moved) {
        const mark = document.getElementById("edit-marquee");
        if (mark) {
          const left = Math.min(box.sx, event.clientX);
          const top = Math.min(box.sy, event.clientY);
          mark.style.display = "block";
          mark.style.left = `${left}px`;
          mark.style.top = `${top}px`;
          mark.style.width = `${Math.abs(event.clientX - box.sx)}px`;
          mark.style.height = `${Math.abs(event.clientY - box.sy)}px`;
        }
      }
    };
    let lastTap = { id: -1, t: 0 };
    const liftFinger = (event: PointerEvent) => {
      if (!fingers.has(event.pointerId)) return false;
      fingers.delete(event.pointerId);
      if (fingers.size < 2) pinch = null;
      if (!fingers.size) {
        const skip = pinched;
        pinched = false;
        if (skip) {
          drag.current = null;
          hideMarquee();
          return true;
        }
      }
      return pinched;
    };
    const onCancel = (event: PointerEvent) => {
      liftFinger(event);
      drag.current = null;
      hideMarquee();
    };
    const onUp = (event: PointerEvent) => {
      hideMarquee();
      if (liftFinger(event)) return;
      const box = drag.current;
      if (!box) return;
      if (box.touch) {
        drag.current = null;
        if (box.moved) return;
      } else if (box.button === 0 && box.moved) {
        finishBox(event);
        return;
      } else if (box.button !== 0 || box.moved) {
        drag.current = null;
        return;
      }
      drag.current = null;
      const rect = canvas.getBoundingClientRect();
      ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      let picked: Unit | null = null;
      let best = Infinity;
      for (const unit of store.units) {
        if (!unit.alive) continue;
        aim.set(unit.x, unit.height * 0.45, unit.z);
        const gap = raycaster.ray.distanceToPoint(aim);
        const along = raycaster.ray.origin.distanceTo(aim);
        const allowance = Math.max(unit.radius, 1.5);
        if (gap < allowance && along < best) {
          best = along;
          picked = unit;
        }
      }
      if (picked) {
        const now = performance.now();
        const dbl = lastTap.id === picked.id && now - lastTap.t < 380;
        lastTap = { id: picked.id, t: now };
        if (dbl) {
          selectNearby(store, picked.id, event.shiftKey);
          return;
        }
        if (event.shiftKey) {
          if (store.selected.has(picked.id)) store.selected.delete(picked.id);
          else store.selected.add(picked.id);
        } else {
          store.selected.clear();
          store.selected.add(picked.id);
        }
        const mates = picked.team > 0 ? store.units.filter((unit) => unit.alive && unit.team === picked.team).length : 0;
        store.note =
          mates > 1
            ? store.placeMode === "member"
              ? `1 üye seçili. Üye taşı: yere tıklayınca sadece o konumlanır (takımda kalır).`
              : `1 asker seçili. Yere tıklayınca ${teamLabel(picked.team)} takımının ${mates} askeri birlikte gider.`
            : `${store.selected.size} asker seçili. Yere tıklayınca oraya gider.`;
        store.bump();
        return;
      }
      if (!raycaster.ray.intersectPlane(plane, hit)) return;
      // Sol+sağ birlikte (biri bırakılırken diğeri basılı): seçimi bırak, taşıma
      const both =
        (event.button === 0 && (event.buttons & 2) === 2) || (event.button === 2 && (event.buttons & 1) === 1);
      if (both && store.selected.size) {
        store.selected.clear();
        store.note = "Seçim bırakıldı (sol+sağ).";
        store.bump();
        return;
      }
      if (event.button !== 0) return;
      if (store.selected.size && !event.shiftKey) {
        moveSelected(store, hit.x, hit.z);
        return;
      }
      if (!event.shiftKey && store.selected.size) {
        store.selected.clear();
        store.bump();
      }
    };
    const swallow = (event: Event) => event.preventDefault();
    // Middle button would otherwise start the browser's autoscroll on Windows.
    const noAutoscroll = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault();
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("contextmenu", swallow);
    canvas.addEventListener("mousedown", noAutoscroll);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("contextmenu", swallow);
      canvas.removeEventListener("mousedown", noAutoscroll);
    };
  }, [camera, gl, store]);

  useFrame((_, dt) => {
    const shot = look.current;
    const step = Math.min(0.05, Math.max(0, dt));
    const pan = (22 + shot.dist * 0.4) * step;
    const turn = 1.15 * step;
    const zoom = Math.exp(1.1 * step);
    const e = camera.matrixWorld.elements;
    const rx = e[0];
    const rz = e[2];
    const fx = -e[8];
    const fz = -e[10];
    const fl = Math.hypot(fx, fz) || 1;
    const rl = Math.hypot(rx, rz) || 1;
    const held = keys.current;
    // Kayıt dahil: ok = kaydır, Q/E = yaw, R/F = pitch, +/- = zoom
    if (held.has("ArrowUp")) {
      store.viewX += (fx / fl) * pan;
      store.viewZ += (fz / fl) * pan;
    }
    if (held.has("ArrowDown")) {
      store.viewX -= (fx / fl) * pan;
      store.viewZ -= (fz / fl) * pan;
    }
    if (held.has("ArrowLeft")) {
      store.viewX -= (rx / rl) * pan;
      store.viewZ -= (rz / rl) * pan;
    }
    if (held.has("ArrowRight")) {
      store.viewX += (rx / rl) * pan;
      store.viewZ += (rz / rl) * pan;
    }
    if (held.has("KeyQ")) shot.yaw += turn;
    if (held.has("KeyE")) shot.yaw -= turn;
    if (held.has("KeyR")) shot.pitch = Math.min(1.35, shot.pitch + turn * 0.75);
    if (held.has("KeyF")) shot.pitch = Math.max(0.12, shot.pitch - turn * 0.75);
    if (held.has("Equal") || held.has("NumpadAdd")) shot.dist = Math.max(5, shot.dist / zoom);
    if (held.has("Minus") || held.has("NumpadSubtract")) shot.dist = Math.min(170, shot.dist * zoom);

    // Kayıtta otomatik takip yok — kullanıcı hakim
    store.viewX = Math.max(-320, Math.min(320, store.viewX));
    store.viewZ = Math.max(-320, Math.min(320, store.viewZ));
    camera.position.set(
      store.viewX + Math.sin(shot.yaw) * Math.cos(shot.pitch) * shot.dist,
      Math.sin(shot.pitch) * shot.dist,
      store.viewZ + Math.cos(shot.yaw) * Math.cos(shot.pitch) * shot.dist
    );
    camera.lookAt(store.viewX, 0, store.viewZ);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = store.recording ? 44 : 42;
      camera.near = 0.2;
      camera.far = 900;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    // 9:16 kadraj kamera bakış merkezinde
    store.reelU = 0.5;
    store.reelV = 0.5;
    const frame = document.querySelector(".edit-reel-frame") as HTMLElement | null;
    if (frame) {
      const rect = gl.domElement.getBoundingClientRect();
      const crop = reelWindow(rect.width, rect.height, store.reelU, store.reelV);
      frame.style.left = `${(crop.cx / rect.width) * 100}%`;
      frame.style.top = `${(crop.cy / rect.height) * 100}%`;
    }

    // Sub-step so a slow phone still fights in real time instead of slow motion; cap keeps tab-switch jumps sane.
    let left = Math.min(0.25, Math.max(0, dt));
    let changed = false;
    do {
      const slice = Math.min(0.05, left);
      left -= slice;
      changed = stepUnits(store, slice) || changed;
    } while (left > 1e-4);
    if (changed) store.bump();

    const grouped = new Map<string, Unit[]>();
    for (const unit of store.units) {
      const list = grouped.get(unit.model);
      if (list) list.push(unit);
      else grouped.set(unit.model, [unit]);
    }
    for (const [id, mesh] of meshes.current) {
      const list = grouped.get(id) ?? [];
      mesh.count = list.length;
      list.forEach((unit, index) => {
        placeUnit(unit);
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, white);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    const host = bodies.current;
    const seen = new Set<number>();
    if (host) {
      for (const unit of store.units) {
        const asset = assets[unit.model];
        if (!asset?.template) continue;
        seen.add(unit.id);
        let actor = actors.current.get(unit.id);
        if (!actor) {
          actor = { ...makeActor(asset), id: unit.id, px: unit.x, pz: unit.z };
          host.add(actor.holder);
          actors.current.set(unit.id, actor);
        }
        if (unit.alive) {
          actor.holder.position.set(unit.x, unit.y, unit.z);
          actor.holder.rotation.set(0, unit.yaw, 0);
          actor.holder.scale.setScalar(1);
          actor.holder.visible = true;
        } else {
          placeUnit(unit);
          actor.holder.position.copy(dummy.position);
          actor.holder.quaternion.copy(dummy.quaternion);
          actor.holder.scale.copy(dummy.scale);
        }
        const moved = Math.hypot(unit.x - actor.px, unit.z - actor.pz) > 0.02;
        actor.px = unit.x;
        actor.pz = unit.z;
        const shooting = unit.swing > 0.08;
        const mode = !unit.alive ? "dead" : shooting && moved ? "fireWalk" : shooting ? "attack" : moved ? "move" : "idle";
        if (mode !== actor.mode) {
          const next =
            mode === "fireWalk"
              ? actor.fireWalk ?? actor.attack ?? actor.move ?? actor.idle
              : mode === "attack"
                ? actor.attack ?? actor.idle
                : mode === "move"
                  ? actor.move ?? actor.idle
                  : actor.idle;
          if (actor.current && actor.current !== next) actor.current.fadeOut(0.12);
          if (next && next !== actor.current) next.reset().fadeIn(0.12).play();
          actor.current = next;
          actor.mode = mode;
        }
        actor.mixer.update(Math.min(0.05, Math.max(0, dt)));
      }
    }
    for (const [id, actor] of actors.current) {
      if (seen.has(id)) continue;
      actor.holder.removeFromParent();
      actor.mixer.stopAllAction();
      actors.current.delete(id);
    }

    const ring = rings.current;
    if (ring) {
      const shown = store.units.filter((unit) => unit.alive).slice(0, 8192);
      ring.count = shown.length;
      // Seçili daire yanıp sönsün — kimi seçtiğin net görünsün
      const blink = 0.5 + 0.5 * Math.sin(performance.now() * 0.01);
      shown.forEach((unit, index) => {
        const picked = store.selected.has(unit.id);
        const base = Math.max(0.45, unit.radius);
        const scale = picked ? base * (0.92 + 0.28 * blink) : base;
        dummy.position.set(unit.x, picked ? 0.08 : 0.06, unit.z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(scale, scale, 1);
        dummy.updateMatrix();
        ring.setMatrixAt(index, dummy.matrix);
        if (picked) tint.copy(gold).lerp(goldHot, blink);
        else tint.copy(teamColor.get(unit.team) ?? white);
        ring.setColorAt(index, tint);
      });
      ring.instanceMatrix.needsUpdate = true;
      if (ring.instanceColor) ring.instanceColor.needsUpdate = true;
    }

    const bar = bars.current;
    if (bar) {
      const shown = store.battle ? store.units.filter((unit) => unit.alive && unit.team > 0).slice(0, 8192) : [];
      bar.count = shown.length;
      shown.forEach((unit, index) => {
        aim.set(unit.x, unit.height + 0.28, unit.z);
        dummy.position.copy(aim);
        dummy.quaternion.copy(camera.quaternion);
        const width = Math.min(2.4, Math.max(0.7, unit.height * 0.16)) * Math.max(0.05, unit.hp / unit.maxHp);
        dummy.scale.set(width, 0.08, 1);
        dummy.updateMatrix();
        bar.setMatrixAt(index, dummy.matrix);
        bar.setColorAt(index, teamColor.get(unit.team) ?? white);
      });
      bar.instanceMatrix.needsUpdate = true;
      if (bar.instanceColor) bar.instanceColor.needsUpdate = true;
    }

    const boltMesh = bolts.current;
    if (boltMesh) {
      const active = store.units.filter((unit) => unit.boltAge > 0).slice(0, 256);
      dummy.scale.setScalar(0.001);
      dummy.position.set(0, -20, 0);
      dummy.quaternion.identity();
      dummy.updateMatrix();
      for (let i = 0; i < 256; i++) boltMesh.setMatrixAt(i, dummy.matrix);
      active.forEach((unit, index) => {
        const u = 1 - unit.boltAge / 0.22;
        const x = unit.boltX + (unit.boltTX - unit.boltX) * u;
        const z = unit.boltZ + (unit.boltTZ - unit.boltZ) * u;
        const dx = unit.boltTX - unit.boltX;
        const dz = unit.boltTZ - unit.boltZ;
        const len = Math.hypot(dx, dz) || 1;
        dummy.position.set(x, 1.3, z);
        dummy.quaternion.setFromUnitVectors(UP, new THREE.Vector3(dx / len, 0, dz / len));
        dummy.scale.set(0.012, Math.min(0.35, len * 0.04), 0.012);
        dummy.updateMatrix();
        boltMesh.setMatrixAt(index, dummy.matrix);
      });
      boltMesh.count = Math.max(1, active.length);
      boltMesh.instanceMatrix.needsUpdate = true;
    }

    const nameHost = names.current;
    if (nameHost) {
      const have = new Set<number>();
      for (const unit of store.units) {
        if (!unit.name || !unit.alive) continue;
        have.add(unit.id);
        let sprite = nameHost.children.find((child) => child.userData.id === unit.id) as THREE.Sprite | undefined;
        if (!sprite) {
          const map = nameTexture(unit.name, maxAniso);
          if (!map) continue;
          sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false }));
          sprite.userData.id = unit.id;
          sprite.userData.label = unit.name;
          sprite.renderOrder = 3;
          nameHost.add(sprite);
        } else if (sprite.userData.label !== unit.name) {
          const map = nameTexture(unit.name, maxAniso);
          if (map) (sprite.material as THREE.SpriteMaterial).map = map;
          sprite.userData.label = unit.name;
        }
        sprite.position.set(unit.x, unit.height + Math.min(1.4, unit.height * 0.12) + 0.35, unit.z);
        // Glyph height is fixed in world units per body size; width follows the label so letters keep their shape.
        const aspect = ((sprite.material as THREE.SpriteMaterial).map?.userData.aspect as number | undefined) ?? 4;
        const cap = Math.min(7, Math.max(2.4, unit.height * 1.4));
        const glyph = Math.min(Math.min(1.5, Math.max(0.42, unit.height * 0.11)), cap / aspect);
        sprite.scale.set(glyph * aspect, glyph, 1);
      }
      for (let i = nameHost.children.length - 1; i >= 0; i--) {
        const child = nameHost.children[i];
        if (!have.has(child.userData.id as number)) nameHost.remove(child);
      }
    }
  });

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      look.current.dist = Math.max(5, Math.min(170, look.current.dist * Math.exp(event.deltaY * 0.0011)));
    };
    gl.domElement.addEventListener("wheel", onWheel, { passive: false });
    return () => gl.domElement.removeEventListener("wheel", onWheel);
  }, [gl]);

  const boltGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 4), []);
  const boltMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffe566", toneMapped: false }), []);

  return (
    <group>
      <group ref={bodies} />
      <instancedMesh ref={rings} args={[ringGeo, ringMat, 8192]} frustumCulled={false} />
      <instancedMesh ref={bars} args={[barGeo, barMat, 8192]} frustumCulled={false} renderOrder={2} />
      <instancedMesh ref={bolts} args={[boltGeo, boltMat, 256]} frustumCulled={false} />
      <group ref={names} />
    </group>
  );
}

export function EditField({ store, assets }: { store: EditStore; assets: Record<string, CharacterAsset> }) {
  const groundId = store.ground;
  const ground = useMemo(() => groundTexture(groundId), [groundId]);
  const tint = groundId === "grass" ? "#9ad86a" : groundId === "asphalt" ? "#9aa4b0" : groundId === "dirt" ? "#c8a06a" : "#b8c0c8";
  useEffect(() => () => ground?.dispose(), [ground]);
  return (
    <>
      <color attach="background" args={["#8ec4f0"]} />
      <fog attach="fog" args={["#d5e4f2", 80, 440]} />
      <hemisphereLight args={["#e8f4ff", "#8aaa58", 1.05]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[24, 36, 12]} intensity={2.6} color="#fff8ee" />
      <mesh key={groundId} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[760, 760]} />
        <meshLambertMaterial map={ground ?? undefined} color={tint} />
      </mesh>
      <EditRig store={store} assets={assets} />
    </>
  );
}
