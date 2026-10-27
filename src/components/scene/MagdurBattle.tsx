import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { buildNameAtlas } from "../../nameAtlas";
import { buildKnightSoldier } from "../../knightSoldier";
import { fitHero } from "./ArenaBattle";
import {
  MAGDUR_DEATHS,
  MAGDUR_HOOK,
  MAGDUR_KNIGHT,
  MAGDUR_N,
  MAGDUR_ROMAN,
  MAGDUR_ROMAN_POSTS,
  MAGDUR_SEATS,
  type MagdurSpear,
  magdurCam,
  magdurCard,
  magdurFall,
  magdurGroup,
  magdurMarkReady,
  magdurReset,
  magdurRoster,
  magdurSpear,
  magdurT,
} from "../../magdurReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

function loadGlb(loader: GLTFLoader, url: string) {
  const buf = preloadedGlb(url);
  return new Promise<Gltf>((ok, fail) => {
    if (buf) loader.parse(buf.slice(0), "", ok, fail);
    else loader.load(url, ok, undefined, fail);
  });
}

function spearGeo() {
  const shaft = new THREE.CylinderGeometry(0.028, 0.02, 2.15, 6);
  shaft.translate(0, 0.15, 0);
  const head = new THREE.ConeGeometry(0.07, 0.28, 6);
  head.translate(0, 1.32, 0);
  return mergeGeometries([shaft, head]) ?? shaft;
}

function paintCard(lines: readonly string[]) {
  const canvas = document.createElement("canvas");
  canvas.width = 980;
  canvas.height = 280;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.beginPath();
  ctx.moveTo(60, 22);
  ctx.arcTo(952, 22, 952, 258, 32);
  ctx.arcTo(952, 258, 28, 258, 32);
  ctx.arcTo(28, 258, 28, 22, 32);
  ctx.arcTo(28, 22, 952, 22, 32);
  ctx.closePath();
  ctx.fillStyle = "#ffd54f";
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#111111";
  ctx.stroke();
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 92px Montserrat, Helvetica, Arial, sans-serif";
  lines.forEach((line, i) => ctx.fillText(line, 490, 104 + i * 94));
  return canvas;
}

function MagdurHud() {
  const size = useThree((s) => s.size);
  const mesh = useRef<THREE.Mesh>(null);
  const map = useMemo(() => {
    const tex = new THREE.CanvasTexture(paintCard(MAGDUR_HOOK));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, []);
  useEffect(() => {
    document.fonts?.load("900 80px Montserrat").then(() => {
      map.image = paintCard(MAGDUR_HOOK);
      map.needsUpdate = true;
    }).catch(() => undefined);
    return () => map.dispose();
  }, [map]);
  useFrame(() => {
    const card = magdurCard(magdurT());
    if (!mesh.current) return;
    mesh.current.visible = Boolean(card && card.opacity > 0.02);
    const mat = mesh.current.material as THREE.MeshBasicMaterial;
    mat.opacity = card?.opacity ?? 0;
  });
  const w = size.width * 0.5;
  return (
    <Hud renderPriority={1}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh ref={mesh} position={[0, size.height * 0.28, 0]}>
        <planeGeometry args={[w, w * (280 / 980)]} />
        <meshBasicMaterial map={map} transparent depthTest={false} toneMapped={false} />
      </mesh>
    </Hud>
  );
}

const dummy = new THREE.Object3D();
const spearTmp: MagdurSpear = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
const up = new THREE.Vector3(0, 1, 0);
const dir = new THREE.Vector3();
const liveTint = new THREE.Color("#f2f4f8");
const deadTint = new THREE.Color("#6a625c");

export function MagdurBattle({ names }: { names: string[] }) {
  const [pack, setPack] = useState<{ body: THREE.BufferGeometry; helm: THREE.BufferGeometry; romans: THREE.Group[] } | null>(null);
  const roster = useMemo(() => magdurRoster(names), [names]);
  const bodies = useRef<THREE.InstancedMesh>(null);
  const helms = useRef<THREE.InstancedMesh>(null);
  const spears = useRef<THREE.InstancedMesh>(null);
  const flames = useRef<THREE.Mesh[]>([]);
  const geo = useMemo(() => spearGeo(), []);
  const named = useMemo(
    () => roster.map((name, i) => ({ name, i })).filter((row) => row.name),
    [roster],
  );
  const atlas = useMemo(
    () =>
      buildNameAtlas(
        named.map((row) => ({ text: row.name, commander: false, plain: false, fill: "#ffe14a", frame: true })),
        true,
        true,
      ),
    [named],
  );

  useEffect(() => {
    let drop = false;
    magdurReset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const knightGltf = await loadGlb(loader, MAGDUR_KNIGHT);
        const romanGltf = await loadGlb(loader, MAGDUR_ROMAN);
        if (drop) return;
        const knight = buildKnightSoldier(knightGltf.scene);
        fitHero(romanGltf.scene, -Math.PI / 2, true, false);
        const romans = MAGDUR_ROMAN_POSTS.map(() => romanGltf.scene.clone(true));
        if (drop) return;
        setPack({ body: knight.body, helm: knight.helm, romans });
      } catch (err) {
        console.warn("magdur", err);
      } finally {
        if (!drop) magdurMarkReady();
      }
    })();
    return () => {
      drop = true;
      magdurReset();
    };
  }, []);

  useEffect(() => {
    for (const sheet of atlas.sheets) sheet.material.depthTest = false;
    return () => atlas.dispose();
  }, [atlas]);

  useFrame(({ camera }) => {
    if (!pack) return;
    const t = magdurT();
    const body = bodies.current;
    const helm = helms.current;
    if (body && helm) {
      for (let i = 0; i < MAGDUR_N; i++) {
        const seat = MAGDUR_SEATS[i];
        const fall = magdurFall(i, t);
        dummy.position.set(seat.x, fall * 0.02, seat.z);
        dummy.rotation.set(0.16 + fall * 1.15, seat.yaw, fall * 0.2);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        body.setMatrixAt(i, dummy.matrix);
        helm.setMatrixAt(i, dummy.matrix);
        const tint = fall > 0.25 ? deadTint : liveTint;
        body.setColorAt(i, tint);
        helm.setColorAt(i, tint);
      }
      body.instanceMatrix.needsUpdate = true;
      helm.instanceMatrix.needsUpdate = true;
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
      if (helm.instanceColor) helm.instanceColor.needsUpdate = true;
    }
    const mesh = spears.current;
    if (mesh) {
      let n = 0;
      for (const death of MAGDUR_DEATHS) {
        if (n >= 16) break;
        const seat = MAGDUR_SEATS[death.i];
        const post = MAGDUR_ROMAN_POSTS[death.roman];
        if (!magdurSpear(t, death.t, { x: post.x, y: 1.55, z: post.z }, { x: seat.x, y: 1.15, z: seat.z }, spearTmp)) continue;
        dir.set(spearTmp.dx, spearTmp.dy, spearTmp.dz);
        if (dir.lengthSq() < 1e-8) continue;
        dummy.position.set(spearTmp.x, spearTmp.y, spearTmp.z);
        dummy.quaternion.setFromUnitVectors(up, dir.normalize());
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
        n += 1;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
    flames.current.forEach((flame, i) => {
      if (!flame) return;
      const wobble = 0.85 + Math.sin(t * 7 + i) * 0.12;
      flame.scale.set(wobble, 0.9 + Math.sin(t * 9 + i * 1.7) * 0.18, wobble);
    });
    for (const sheet of atlas.sheets) {
      const inst = sheet.geometry.userData.mesh as THREE.InstancedMesh | undefined;
      if (!inst) continue;
      for (let n = 0; n < named.length; n++) {
        const cell = atlas.cells[n];
        if (!cell || cell.sheet !== atlas.sheets.indexOf(sheet)) continue;
        const seat = MAGDUR_SEATS[named[n].i];
        const fall = magdurFall(seat.i, t);
        const hide = t < 3.7 || fall > 0.4;
        const w = Math.min(cell.sx, 1.55);
        const h = (cell.sy * w) / Math.max(cell.sx, 0.01);
        dummy.position.set(seat.x, hide ? -8 : 1.72 + (seat.seat % 3) * 0.46, seat.z);
        dummy.quaternion.copy(camera.quaternion);
        dummy.scale.set(hide ? 0.001 : w, hide ? 0.001 : h, 1);
        dummy.updateMatrix();
        inst.setMatrixAt(cell.local, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  });

  if (!pack) return null;

  return (
    <group>
      <hemisphereLight args={["#b7c6d8", "#6a5844", 1.15]} />
      <directionalLight position={[-12, 18, 8]} intensity={0.85} color="#d5deea" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshLambertMaterial color="#5c6a52" />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => {
        const spec = magdurGroup(i);
        return (
          <group key={i} position={[spec.x, 0, spec.z]}>
            <mesh rotation={[0, i, Math.PI / 2]} position={[0.35, 0.16, 0]}>
              <cylinderGeometry args={[0.12, 0.14, 1.4, 6]} />
              <meshLambertMaterial color="#5a3d28" />
            </mesh>
            <mesh position={[0, 0.08, 0]}>
              <cylinderGeometry args={[0.55, 0.7, 0.08, 8]} />
              <meshLambertMaterial color="#6a4a2c" />
            </mesh>
            <mesh ref={(node) => { flames.current[i] = node as THREE.Mesh; }} position={[0, 0.55, 0]}>
              <coneGeometry args={[0.22, 0.7, 6]} />
              <meshBasicMaterial color="#ffb15a" />
            </mesh>
            <pointLight position={[0, 1.1, 0]} intensity={7} distance={8.5} color="#ff9a4a" />
          </group>
        );
      })}
      {pack.romans.map((roman, i) => (
        <group key={i} position={[MAGDUR_ROMAN_POSTS[i].x, 0, MAGDUR_ROMAN_POSTS[i].z]} rotation={[0, MAGDUR_ROMAN_POSTS[i].yaw, 0]} scale={1.2}>
          <primitive object={roman} />
        </group>
      ))}
      <instancedMesh ref={bodies} args={[pack.body, undefined, MAGDUR_N]} frustumCulled={false}>
        <meshLambertMaterial color="#f4f7fb" />
      </instancedMesh>
      <instancedMesh ref={helms} args={[pack.helm, undefined, MAGDUR_N]} frustumCulled={false}>
        <meshLambertMaterial color="#d5dbe3" />
      </instancedMesh>
      <instancedMesh ref={spears} args={[geo, undefined, 16]} frustumCulled={false} count={0}>
        <meshBasicMaterial color="#e6d2a8" />
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
      <MagdurHud />
    </group>
  );
}

export function MagdurCam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const shot = magdurCam(magdurT());
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
