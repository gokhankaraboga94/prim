import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TEAMS } from "../../edit/catalog";
import { moveSelected, selectNearby, stepUnits, teamLabel, type EditStore, type Unit } from "../../edit/battle";
import type { CharacterAsset } from "../../edit/loadModel";
import { MAX_PER_MODEL, MAX_UNITS } from "../../edit/catalog";
import { reelWindow } from "../../recordCanvas";

const teamColor = new Map<number, THREE.Color>(TEAMS.map((team) => [team.id, new THREE.Color(team.color)]));
const white = new THREE.Color("#ffffff");
const gold = new THREE.Color("#ffe08a");
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

function grassTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#4e9a38";
  ctx.fillRect(0, 0, 2048, 2048);
  for (let i = 0; i < 18000; i++) {
    const n = i % 7;
    ctx.fillStyle = n === 0 ? "#7ec85a" : n === 1 ? "#3d8228" : n === 2 ? "#68b448" : n === 3 ? "#357820" : n === 4 ? "#96d868" : n === 5 ? "#5aa838" : "#2c681c";
    ctx.fillRect(Math.random() * 2048, Math.random() * 2048, 2 + Math.random() * 7, 2 + Math.random() * 6);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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

function EditRig({ store, assets }: { store: EditStore; assets: Record<string, CharacterAsset> }) {
  const { camera, gl } = useThree();
  const bodies = useRef<THREE.Group>(null);
  const rings = useRef<THREE.InstancedMesh>(null);
  const bars = useRef<THREE.InstancedMesh>(null);
  const names = useRef<THREE.Group>(null);
  const maxAniso = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);
  const meshes = useRef(new Map<string, THREE.InstancedMesh>());
  const keys = useRef(new Set<string>());
  const look = useRef({ yaw: 0.45, pitch: 0.78, dist: 38 });
  const drag = useRef<{ x: number; y: number; button: number; moved: boolean; sx: number; sy: number } | null>(null);
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.78, 1, 28), []);
  const barGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }), []);
  const barMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95, depthTest: false }), []);

  useEffect(() => {
    const host = bodies.current;
    if (!host) return;
    for (const [id, asset] of Object.entries(assets)) {
      if (meshes.current.has(id)) continue;
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
    return () => {
      // Geometry and material belong to the asset; only the instance buffers go here.
      for (const mesh of pool.values()) mesh.dispose();
      pool.clear();
    };
  }, []);

  useEffect(() => {
    const keysRef = keys.current;
    const down = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!event.key.startsWith("Arrow")) return;
      event.preventDefault();
      keysRef.add(event.key);
    };
    const up = (event: KeyboardEvent) => keysRef.delete(event.key);
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
      }
      if (event.button === 0 || event.button === 1 || event.button === 2) {
        drag.current = { x: event.clientX, y: event.clientY, button: event.button, moved: false, sx: event.clientX, sy: event.clientY };
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
      if (box.button === 0 && box.moved) {
        finishBox(event);
        return;
      }
      drag.current = null;
      if (box.button !== 0 || box.moved) return;
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
        store.note = mates > 1 ? `1 asker seçili. Yere tıklayınca ${teamLabel(picked.team)} takımının ${mates} askeri birlikte gider.` : `${store.selected.size} asker seçili. Yere tıklayınca oraya gider.`;
        store.bump();
        return;
      }
      if (!raycaster.ray.intersectPlane(plane, hit)) return;
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
    const speed = (18 + shot.dist * 0.35) * Math.min(0.05, dt);
    const e = camera.matrixWorld.elements;
    const rx = e[0];
    const rz = e[2];
    const fx = -e[8];
    const fz = -e[10];
    const fl = Math.hypot(fx, fz) || 1;
    const rl = Math.hypot(rx, rz) || 1;
    if (keys.current.has("ArrowUp")) {
      store.viewX += (fx / fl) * speed;
      store.viewZ += (fz / fl) * speed;
    }
    if (keys.current.has("ArrowDown")) {
      store.viewX -= (fx / fl) * speed;
      store.viewZ -= (fz / fl) * speed;
    }
    if (keys.current.has("ArrowLeft")) {
      store.viewX -= (rx / rl) * speed;
      store.viewZ -= (rz / rl) * speed;
    }
    if (keys.current.has("ArrowRight")) {
      store.viewX += (rx / rl) * speed;
      store.viewZ += (rz / rl) * speed;
    }
    const fighters = store.units.filter((unit) => unit.alive && unit.team > 0);
    if (store.recording && fighters.length) {
      let cx = 0;
      let cz = 0;
      for (const unit of fighters) {
        cx += unit.x;
        cz += unit.z;
      }
      cx /= fighters.length;
      cz /= fighters.length;
      const glide = 1 - Math.exp(-Math.min(0.05, Math.max(0, dt)) * 2.4);
      store.viewX += (cx - store.viewX) * glide;
      store.viewZ += (cz - store.viewZ) * glide;
    }
    store.viewX = Math.max(-320, Math.min(320, store.viewX));
    store.viewZ = Math.max(-320, Math.min(320, store.viewZ));
    camera.position.set(
      store.viewX + Math.sin(shot.yaw) * Math.cos(shot.pitch) * shot.dist,
      Math.sin(shot.pitch) * shot.dist,
      store.viewZ + Math.cos(shot.yaw) * Math.cos(shot.pitch) * shot.dist
    );
    camera.lookAt(store.viewX, 0, store.viewZ);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 42;
      camera.near = 0.2;
      camera.far = 900;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    if (fighters.length) {
      let px = 0;
      let py = 0;
      let pz = 0;
      for (const unit of fighters) {
        px += unit.x;
        py += unit.height * 0.45;
        pz += unit.z;
      }
      aim.set(px / fighters.length, py / fighters.length, pz / fighters.length);
      aim.project(camera);
      store.reelU = aim.x * 0.5 + 0.5;
      store.reelV = -aim.y * 0.5 + 0.5;
    } else {
      store.reelU = 0.5;
      store.reelV = 0.5;
    }
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

    const ring = rings.current;
    if (ring) {
      const shown = store.units.filter((unit) => unit.alive);
      ring.count = shown.length;
      shown.forEach((unit, index) => {
        const scale = Math.max(0.45, unit.radius);
        dummy.position.set(unit.x, 0.06, unit.z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(scale, scale, 1);
        dummy.updateMatrix();
        ring.setMatrixAt(index, dummy.matrix);
        tint.copy(store.selected.has(unit.id) ? gold : teamColor.get(unit.team) ?? white);
        ring.setColorAt(index, tint);
      });
      ring.instanceMatrix.needsUpdate = true;
      if (ring.instanceColor) ring.instanceColor.needsUpdate = true;
    }

    const bar = bars.current;
    if (bar) {
      const shown = store.battle ? store.units.filter((unit) => unit.alive && unit.team > 0) : [];
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

  return (
    <group>
      <group ref={bodies} />
      <instancedMesh ref={rings} args={[ringGeo, ringMat, MAX_UNITS]} frustumCulled={false} />
      <instancedMesh ref={bars} args={[barGeo, barMat, MAX_UNITS]} frustumCulled={false} renderOrder={2} />
      <group ref={names} />
    </group>
  );
}

export function EditField({ store, assets }: { store: EditStore; assets: Record<string, CharacterAsset> }) {
  const grass = useMemo(() => grassTexture(), []);
  useEffect(() => () => grass?.dispose(), [grass]);
  return (
    <>
      <color attach="background" args={["#7eb6ee"]} />
      <fog attach="fog" args={["#d5e4f2", 70, 420]} />
      <hemisphereLight args={["#d7ecff", "#6d8a45", 0.85]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[24, 36, 12]} intensity={2.1} color="#fff4e2" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[760, 760]} />
        <meshLambertMaterial map={grass} color="#68b44a" />
      </mesh>
      <EditRig store={store} assets={assets} />
    </>
  );
}
