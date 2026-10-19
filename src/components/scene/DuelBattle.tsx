import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { REEL_HOLD } from "../../recordCanvas";
import { simplifySkinned } from "../../knightSoldier";
import {
  HULK_H,
  HULK_HITS,
  HULK_HOME,
  KONG2_FALL,
  KONG2_H,
  KONG2_HITS,
  KONG2_HOME,
  KONG_H,
  KONG_HITS,
  KONG_HOME,
  ORC_FALL,
  ORC_H,
  ORC_HITS,
  ORC_HOME,
  bout2Hp,
  boutCam,
  boutHp,
  boutPunch,
  boutRecoil,
  hulkKickPose,
} from "../../boutReel";

const KONG_URL = "/models/bigfoot.glb";
const ORC_URL = "/models/orc.glb";
const HULK_URL = "/models/hulk+3d+model.glb";
const HULK_HIP = new THREE.Vector3(-0.155, 0.43, 0.02);
const HULK_KNEE = new THREE.Vector3(-0.145, 0.25, 0.005);
const HULK_ANKLE = new THREE.Vector3(-0.17, 0.09, -0.04);
const KICK_AXIS = new THREE.Vector3(1, 0, 0);
const qHip = new THREE.Quaternion();
const qKnee = new THREE.Quaternion();
const qAnkle = new THREE.Quaternion();
const relKnee = new THREE.Vector3();
const kneeNow = new THREE.Vector3();
const ankleNow = new THREE.Vector3();
const KONG_L = new THREE.Vector3(-0.13, 0.7, 0.02);
const KONG_R = new THREE.Vector3(0.13, 0.7, 0.02);
const ORC_L = new THREE.Vector3(-0.15, 0.6, 0.02);
const ORC_R = new THREE.Vector3(0.15, 0.6, 0.02);
const qSwing = new THREE.Quaternion();
const qLift = new THREE.Quaternion();
const euler = new THREE.Euler();
const tmp = new THREE.Vector3();
const spot = new THREE.Vector3();

type Swing = {
  geo: THREE.BufferGeometry | null;
  pos: THREE.BufferAttribute | null;
  rest: Float32Array | null;
  weight: Float32Array | null;
  side: Float32Array | null;
};

function cheapMaterial(src: THREE.Material) {
  const mat = (Array.isArray(src) ? src[0] : src) as THREE.MeshStandardMaterial;
  const next = new THREE.MeshLambertMaterial({
    map: mat.map ?? null,
    color: mat.color ? mat.color.clone() : "#ffffff",
  });
  mat.map = null;
  mat.normalMap?.dispose();
  mat.roughnessMap?.dispose();
  mat.metalnessMap?.dispose();
  mat.dispose();
  return next;
}

function fittedBody(root: THREE.Object3D, height: number) {
  let mesh: THREE.Mesh | null = null;
  root.traverse((obj) => {
    const item = obj as THREE.Mesh;
    if (item.isMesh && !mesh) mesh = item;
  });
  if (!mesh) return null;
  const source = mesh as THREE.Mesh;
  source.updateWorldMatrix(true, false);
  const geo = source.geometry.clone();
  geo.applyMatrix4(source.matrixWorld);
  geo.computeBoundingBox();
  const span = geo.boundingBox ? Math.max(0.001, geo.boundingBox.max.y - geo.boundingBox.min.y) : 1;
  const next = simplifySkinned(geo, span * 0.013);
  geo.dispose();
  source.geometry.dispose();
  const body = new THREE.Mesh(next, cheapMaterial(Array.isArray(source.material) ? source.material[0] : source.material));
  body.frustumCulled = false;
  const box = new THREE.Box3().setFromBufferAttribute(next.getAttribute("position") as THREE.BufferAttribute);
  const fit = height / Math.max(0.001, box.max.y - box.min.y);
  const host = new THREE.Group();
  host.add(body);
  host.scale.setScalar(fit);
  host.position.set(-((box.min.x + box.max.x) / 2) * fit, -box.min.y * fit, -((box.min.z + box.max.z) / 2) * fit);
  return { host, geo: next };
}

function armWeights(pos: THREE.BufferAttribute, kong: boolean) {
  const rest = new Float32Array((pos.array as Float32Array).length);
  rest.set(pos.array as Float32Array);
  const weight = new Float32Array(pos.count);
  const side = new Float32Array(pos.count);
  const y0 = kong ? 0.22 : 0.14;
  const x0 = kong ? 0.13 : 0.16;
  const span = kong ? 0.1 : 0.14;
  for (let i = 0; i < pos.count; i++) {
    const x = rest[i * 3];
    const y = rest[i * 3 + 1];
    const ax = Math.abs(x);
    if (ax < x0 || y < y0 || y > 0.7) continue;
    side[i] = x < 0 ? -1 : 1;
    const u = Math.min(1, (ax - x0) / span);
    weight[i] = u * u * (3 - 2 * u);
  }
  return { rest, weight, side };
}

function swingVerts(swing: Swing, angle: number, hand: 1 | -1, left: THREE.Vector3, right: THREE.Vector3, lift = 0, push = 0) {
  const pos = swing.pos;
  const rest = swing.rest;
  const weight = swing.weight;
  const side = swing.side;
  if (!pos || !rest || !weight || !side) return;
  for (let i = 0; i < side.length; i++) {
    const w = weight[i];
    if (w <= 0) continue;
    const o = i * 3;
    const active = side[i] === hand;
    const yaw = side[i] < 0 ? angle : -angle;
    const roll = active ? (side[i] < 0 ? -lift : lift) : 0;
    euler.set(0, 0, active ? roll : 0);
    qLift.setFromEuler(euler);
    euler.set(0, active ? yaw : yaw * -0.12, 0);
    qSwing.setFromEuler(euler).multiply(qLift);
    const pivot = side[i] < 0 ? left : right;
    tmp.set(rest[o], rest[o + 1], rest[o + 2]).sub(pivot);
    tmp.applyQuaternion(qSwing).add(pivot);
    const drive = active && push > 0 ? push * w : 0;
    pos.setXYZ(
      i,
      rest[o] + (tmp.x - rest[o]) * w,
      rest[o + 1] + (tmp.y - rest[o + 1]) * w,
      rest[o + 2] + (tmp.z - rest[o + 2]) * w + drive
    );
  }
  pos.needsUpdate = true;
  if (Math.abs(angle) > 0.04 || lift > 0.04) swing.geo?.computeVertexNormals();
}

function dropHost(host: THREE.Object3D | null) {
  if (!host) return;
  host.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      std.map?.dispose();
      std.normalMap?.dispose();
      std.roughnessMap?.dispose();
      std.metalnessMap?.dispose();
      mat.dispose();
    }
  });
  host.clear();
}

function DuelKong() {
  const root = useRef<THREE.Group>(null);
  const swing = useMemo<Swing>(
    () => ({ geo: null, pos: null, rest: null, weight: null, side: null }),
    []
  );
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    loader.load(KONG_URL, (gltf) => {
      const host = root.current;
      if (drop || !host) return;
      const fitted = fittedBody(gltf.scene, KONG_H);
      if (!fitted) return;
      swing.geo = fitted.geo;
      swing.pos = fitted.geo.getAttribute("position") as THREE.BufferAttribute;
      const arms = armWeights(swing.pos, true);
      swing.rest = arms.rest;
      swing.weight = arms.weight;
      swing.side = arms.side;
      host.add(fitted.host);
    });
    return () => {
      drop = true;
      const host = root.current;
      swing.geo = null;
      swing.pos = null;
      swing.rest = null;
      swing.weight = null;
      swing.side = null;
      dropHost(host);
    };
  }, [root, swing]);
  useFrame(({ clock }) => {
    const node = root.current;
    if (!node) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const punch = boutPunch(t, KONG_HITS);
    const hand = 1 as const;
    const recoil = boutRecoil(t, ORC_HITS);
    const lunge = Math.max(0, punch.a);
    node.position.set(KONG_HOME + lunge * 2.05 - recoil * 0.28, Math.abs(Math.sin(t * 2.4)) * 0.08, hand * lunge * 0.08);
    const lift = Math.max(0, -punch.a) * 1.9 + Math.max(0, punch.a) * 1.15;
    node.rotation.set(lunge * 0.08, Math.PI / 2 + hand * punch.a * 0.16, -recoil * 0.04);
    swingVerts(swing, punch.a * 1.6, hand, KONG_L, KONG_R, lift, lunge * 0.075);
  });
  return (
    <>
      <group ref={root} />
      <HpPlate host={root} lift={KONG_H + 1.8} label="KONG" side="kong" />
    </>
  );
}

function DuelOrc() {
  const root = useRef<THREE.Group>(null);
  const swing = useMemo<Swing>(
    () => ({ geo: null, pos: null, rest: null, weight: null, side: null }),
    []
  );
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    loader.load(ORC_URL, (gltf) => {
      const host = root.current;
      if (drop || !host) return;
      const fitted = fittedBody(gltf.scene, ORC_H);
      if (!fitted) return;
      swing.geo = fitted.geo;
      swing.pos = fitted.geo.getAttribute("position") as THREE.BufferAttribute;
      const arms = armWeights(swing.pos, false);
      swing.rest = arms.rest;
      swing.weight = arms.weight;
      swing.side = arms.side;
      host.add(fitted.host);
    });
    return () => {
      drop = true;
      swing.geo = null;
      swing.pos = null;
      swing.rest = null;
      swing.weight = null;
      swing.side = null;
      dropHost(root.current);
    };
  }, [root, swing]);
  useFrame(({ clock }) => {
    const node = root.current;
    if (!node) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const fallen = Math.max(0, Math.min(1, (t - ORC_FALL) / 2.4));
    const punch = fallen > 0 ? { a: 0, hand: 1 as const } : boutPunch(t, ORC_HITS);
    const recoil = fallen > 0 ? 0 : boutRecoil(t, KONG_HITS);
    const lunge = Math.max(0, punch.a);
    const lift = Math.max(0, -punch.a) * 1.2;
    node.position.set(ORC_HOME - lunge * 1.55 + recoil * 0.22, 0, punch.hand * lunge * 0.06);
    node.rotation.order = "YXZ";
    node.rotation.set(fallen * 1.5 + lunge * 0.06, -Math.PI / 2 - punch.hand * punch.a * 0.14, fallen * 0.42 + recoil * 0.05);
    swingVerts(swing, punch.a * 1.05, punch.hand, ORC_L, ORC_R, lift, lunge * 0.085);
  });
  return (
    <>
      <group ref={root} />
      <HpPlate host={root} lift={ORC_H + 1.6} label="ORK" side="orc" />
    </>
  );
}

function fade(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function kickVerts(
  pos: THREE.BufferAttribute,
  rest: Float32Array,
  hipW: Float32Array,
  kneeW: Float32Array,
  ankleW: Float32Array,
  pose: { hip: number; knee: number; ankle: number }
) {
  qHip.setFromAxisAngle(KICK_AXIS, pose.hip);
  qKnee.setFromAxisAngle(KICK_AXIS, pose.knee);
  qAnkle.setFromAxisAngle(KICK_AXIS, pose.ankle);
  relKnee.copy(HULK_KNEE).sub(HULK_HIP).applyQuaternion(qHip);
  kneeNow.copy(relKnee).add(HULK_HIP);
  ankleNow.copy(HULK_ANKLE).sub(HULK_HIP).applyQuaternion(qHip).sub(relKnee).applyQuaternion(qKnee).add(relKnee).add(HULK_HIP);
  for (let i = 0; i < hipW.length; i++) {
    const wh = hipW[i];
    const o = i * 3;
    const ox = rest[o];
    const oy = rest[o + 1];
    const oz = rest[o + 2];
    if (wh <= 0) continue;
    tmp.set(ox - HULK_HIP.x, oy - HULK_HIP.y, oz - HULK_HIP.z).applyQuaternion(qHip);
    let x = ox + (HULK_HIP.x + tmp.x - ox) * wh;
    let y = oy + (HULK_HIP.y + tmp.y - oy) * wh;
    let z = oz + (HULK_HIP.z + tmp.z - oz) * wh;
    const wk = kneeW[i];
    if (wk > 0) {
      tmp.set(x - kneeNow.x, y - kneeNow.y, z - kneeNow.z).applyQuaternion(qKnee);
      x += (kneeNow.x + tmp.x - x) * wk;
      y += (kneeNow.y + tmp.y - y) * wk;
      z += (kneeNow.z + tmp.z - z) * wk;
    }
    const wa = ankleW[i];
    if (wa > 0) {
      tmp.set(x - ankleNow.x, y - ankleNow.y, z - ankleNow.z).applyQuaternion(qAnkle);
      x += (ankleNow.x + tmp.x - x) * wa;
      y += (ankleNow.y + tmp.y - y) * wa;
      z += (ankleNow.z + tmp.z - z) * wa;
    }
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
}

function HpPlate({
  host,
  lift,
  label,
  side,
  read,
}: {
  host: RefObject<THREE.Group | null>;
  lift: number;
  label: string;
  side?: "kong" | "orc";
  read?: (t: number) => number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame(({ camera, clock }) => {
    const node = mesh.current;
    const body = host.current;
    if (!node || !body) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const hp = read ? read(t) : boutHp(t)[side ?? "kong"];
    const canvas = tex.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, 512, 128);
      ctx.fillStyle = "rgba(6,8,12,0.78)";
      ctx.fillRect(8, 18, 496, 96);
      ctx.fillStyle = "#2a0808";
      ctx.fillRect(28, 58, 456, 36);
      ctx.fillStyle = "#e10600";
      ctx.fillRect(28, 58, Math.max(0, 456 * (hp / 100)), 36);
      ctx.strokeStyle = "#ff2a22";
      ctx.lineWidth = 6;
      ctx.strokeRect(22, 52, 468, 48);
      ctx.font = "700 36px Inter, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, 28, 40);
      ctx.textAlign = "right";
      ctx.fillText(String(hp), 478, 40);
      tex.needsUpdate = true;
    }
    spot.set(0, lift, 0);
    body.localToWorld(spot);
    node.position.copy(spot);
    node.quaternion.copy(camera.quaternion);
  });
  return (
    <mesh ref={mesh} renderOrder={8}>
      <planeGeometry args={[6.8, 1.7]} />
      <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
    </mesh>
  );
}

export function DuelCam() {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera, clock }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = boutCam(Math.max(0, clock.elapsedTime - REEL_HOLD));
    persp.fov = shot.fov;
    persp.near = 0.4;
    persp.far = 2400;
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

function BoutHulk() {
  const root = useRef<THREE.Group>(null);
  const leg = useMemo(
    () => ({
      geo: null as THREE.BufferGeometry | null,
      pos: null as THREE.BufferAttribute | null,
      rest: null as Float32Array | null,
      hip: null as Float32Array | null,
      knee: null as Float32Array | null,
      ankle: null as Float32Array | null,
      posed: false,
    }),
    []
  );
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    loader.load(HULK_URL, (gltf) => {
      const host = root.current;
      if (drop || !host) return;
      const model = gltf.scene;
      let mesh: THREE.Mesh | null = null;
      model.traverse((obj) => {
        const item = obj as THREE.Mesh;
        if (item.isMesh && !mesh) mesh = item;
      });
      if (!mesh) return;
      const body = mesh as THREE.Mesh;
      body.frustumCulled = false;
      const reduced = simplifySkinned(body.geometry.clone(), 0.006);
      body.geometry.dispose();
      body.geometry = reduced;
      const attr = reduced.getAttribute("position") as THREE.BufferAttribute;
      const rest = new Float32Array(attr.array.length);
      rest.set(attr.array as Float32Array);
      const hipW = new Float32Array(attr.count);
      const kneeW = new Float32Array(attr.count);
      const ankleW = new Float32Array(attr.count);
      for (let i = 0; i < attr.count; i++) {
        const x = rest[i * 3];
        const y = rest[i * 3 + 1];
        if (x > -0.04 || y > 0.5 || (y > 0.33 && x < -0.235)) continue;
        const hip = fade(0.48, 0.37, y) * fade(-0.04, -0.1, x);
        if (hip <= 0) continue;
        hipW[i] = hip;
        kneeW[i] = hip > 0.85 ? fade(0.3, 0.2, y) : 0;
        ankleW[i] = kneeW[i] > 0.9 ? fade(0.13, 0.05, y) : 0;
      }
      leg.geo = body.geometry;
      leg.pos = attr;
      leg.rest = rest;
      leg.hip = hipW;
      leg.knee = kneeW;
      leg.ankle = ankleW;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const fit = HULK_H / Math.max(0.001, box.max.y - box.min.y);
      model.scale.setScalar(fit);
      model.position.set(-((box.min.x + box.max.x) / 2) * fit, -box.min.y * fit, -((box.min.z + box.max.z) / 2) * fit);
      host.add(model);
    });
    return () => {
      drop = true;
      leg.geo = null;
      leg.pos = null;
      leg.rest = null;
      leg.hip = null;
      leg.knee = null;
      leg.ankle = null;
      leg.posed = false;
      dropHost(root.current);
    };
  }, [leg]);
  useFrame(({ clock }) => {
    const node = root.current;
    const pos = leg.pos;
    const rest = leg.rest;
    const hipW = leg.hip;
    const kneeW = leg.knee;
    const ankleW = leg.ankle;
    if (!node || !pos || !rest || !hipW || !kneeW || !ankleW) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const kick = hulkKickPose(t, HULK_HITS);
    const recoil = boutRecoil(t, KONG2_HITS);
    node.position.set(HULK_HOME + kick.lunge - recoil * 0.28, 0, 0);
    node.rotation.set(0, Math.PI / 2, -recoil * 0.04);
    const active = Math.abs(kick.hip) + Math.abs(kick.knee) + Math.abs(kick.ankle) > 0.001;
    if (!active) {
      if (!leg.posed) return;
      (pos.array as Float32Array).set(rest);
      pos.needsUpdate = true;
      leg.posed = false;
      return;
    }
    kickVerts(pos, rest, hipW, kneeW, ankleW, kick);
    leg.posed = true;
  });
  return (
    <>
      <group ref={root} />
      <HpPlate host={root} lift={HULK_H + 1.8} label="HULK" read={(t) => bout2Hp(t).hulk} />
    </>
  );
}

function BoutKong() {
  const root = useRef<THREE.Group>(null);
  const swing = useMemo<Swing>(() => ({ geo: null, pos: null, rest: null, weight: null, side: null }), []);
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    loader.load(KONG_URL, (gltf) => {
      const host = root.current;
      if (drop || !host) return;
      const fitted = fittedBody(gltf.scene, KONG2_H);
      if (!fitted) return;
      swing.geo = fitted.geo;
      swing.pos = fitted.geo.getAttribute("position") as THREE.BufferAttribute;
      const arms = armWeights(swing.pos, true);
      swing.rest = arms.rest;
      swing.weight = arms.weight;
      swing.side = arms.side;
      host.add(fitted.host);
    });
    return () => {
      drop = true;
      swing.geo = null;
      swing.pos = null;
      swing.rest = null;
      swing.weight = null;
      swing.side = null;
      dropHost(root.current);
    };
  }, [swing]);
  useFrame(({ clock }) => {
    const node = root.current;
    if (!node) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const fallen = Math.max(0, Math.min(1, (t - KONG2_FALL) / 2.4));
    const punch = fallen > 0 ? { a: 0, hand: 1 as const } : boutPunch(t, KONG2_HITS);
    const hand = 1 as const;
    const recoil = fallen > 0 ? 0 : boutRecoil(t, HULK_HITS);
    const lunge = Math.max(0, punch.a);
    const lift = Math.max(0, -punch.a) * 1.9 + Math.max(0, punch.a) * 1.15;
    node.position.set(KONG2_HOME - lunge * 2.05 + recoil * 0.35, -fallen * 0.35, hand * lunge * 0.08);
    node.rotation.order = "YXZ";
    node.rotation.set(fallen * 1.5 + lunge * 0.08, -Math.PI / 2 - punch.a * 0.16, fallen * 0.42 + recoil * 0.05);
    swingVerts(swing, punch.a * 1.6, hand, KONG_L, KONG_R, lift, lunge * 0.075);
  });
  return (
    <>
      <group ref={root} />
      <HpPlate host={root} lift={KONG2_H + 1.8} label="KONG" read={(t) => bout2Hp(t).kong} />
    </>
  );
}

export function DuelBattle() {
  return (
    <group>
      <DuelKong />
      <DuelOrc />
    </group>
  );
}

export function HulkKongBattle() {
  return (
    <group>
      <BoutHulk />
      <BoutKong />
    </group>
  );
}
