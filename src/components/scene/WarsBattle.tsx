import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { buildKnightSoldier } from "../../knightSoldier";
import { buildNameAtlas, type NameAtlas, type NameCell } from "../../nameAtlas";
import { REEL_HOLD } from "../../recordCanvas";
import { WARS_FOES, WARS_FRIENDS, WARS_RING_IN, WARS_RING_OUT, warsCam, warsKnight, warsRoman } from "../../warsReel";

const dummy = new THREE.Object3D();
const NAME_S = 0.72;

type RomanPart = { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial };

function tuneRoman(src: THREE.Material) {
  const mat = (src as THREE.MeshStandardMaterial).clone();
  const c = mat.color;
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  const sat = max < 0.02 ? 0 : (max - min) / max;
  const metal = (min < 0.9 && sat < 0.2 && max > 0.3 && max < 0.95) || (max < 0.4 && min > 0.04 && sat < 0.65);
  mat.metalness = metal ? 0.7 : 0.05;
  mat.roughness = metal ? 0.3 : 0.62;
  mat.envMapIntensity = metal ? 1 : 0.42;
  return mat;
}

function buildRoman(root: THREE.Object3D): RomanPart[] {
  root.updateMatrixWorld(true);
  const raw: RomanPart[] = [];
  const box = new THREE.Box3();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    geo.computeBoundingBox();
    if (geo.boundingBox) box.union(geo.boundingBox);
    const src = mesh.material;
    raw.push({ geometry: geo, material: tuneRoman(Array.isArray(src) ? src[0] : src) });
  });
  const height = Math.max(0.001, box.max.y - box.min.y);
  const s = 1.66 / height;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const fit = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-cx, -box.min.y, -cz));
  for (const part of raw) {
    part.geometry.applyMatrix4(fit);
    part.geometry.computeVertexNormals();
  }
  return raw;
}

function pose(x: number, z: number, yaw: number, fall: number, pitch: number, roll: number, y = 0.05) {
  const ease = fall * fall;
  dummy.rotation.order = "YXZ";
  dummy.position.set(x, y, z);
  dummy.rotation.set(pitch, yaw, roll);
  dummy.scale.setScalar(1);
  dummy.updateMatrix();
}

export function WarsCam() {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera, clock }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = warsCam(Math.max(0, clock.elapsedTime - REEL_HOLD));
    persp.fov = shot.fov;
    persp.near = 0.4;
    persp.far = 420;
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

function WarsGround() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color="#3d4a38" roughness={0.94} metalness={0.02} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <circleGeometry args={[WARS_RING_IN, 96]} />
        <meshStandardMaterial color="#b08958" roughness={0.88} metalness={0.03} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.045, 0]}>
        <circleGeometry args={[6.8, 72]} />
        <meshStandardMaterial color="#8c6840" roughness={0.92} metalness={0.02} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, 0]}>
        <ringGeometry args={[WARS_RING_IN, WARS_RING_OUT, 160]} />
        <meshStandardMaterial color="#07080c" roughness={0.46} metalness={0.38} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.09, 0]}>
        <ringGeometry args={[WARS_RING_IN - 0.16, WARS_RING_IN, 160]} />
        <meshStandardMaterial color="#d7dee6" roughness={0.28} metalness={0.82} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.08, 0]}>
        <ringGeometry args={[WARS_RING_OUT - 0.08, WARS_RING_OUT + 0.05, 160]} />
        <meshStandardMaterial color="#1a1c22" roughness={0.4} metalness={0.5} />
      </mesh>
    </group>
  );
}

function WarsFighters() {
  const [knight, setKnight] = useState<{ body: THREE.BufferGeometry; helm: THREE.BufferGeometry } | null>(null);
  const [roman, setRoman] = useState<RomanPart[] | null>(null);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const helmRef = useRef<THREE.InstancedMesh>(null);
  const bloodRef = useRef<THREE.InstancedMesh>(null);
  const romanRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a56e8", roughness: 0.42, metalness: 0.38, envMapIntensity: 0.85 }), []);
  const helmMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e7eef5", roughness: 0.18, metalness: 0.9, envMapIntensity: 1.15 }), []);
  const bloodMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#6a1814", roughness: 0.86, metalness: 0.04 }), []);
  const bloodGeo = useMemo(() => new THREE.CircleGeometry(0.62, 18), []);

  useEffect(() => {
    let drop = false;
    const loader = new GLTFLoader();
    loader.load("/models/knight.glb", (gltf) => {
      if (drop) return;
      setKnight(buildKnightSoldier(gltf.scene));
    });
    loader.load("/models/roman.glb", (gltf) => {
      const built = buildRoman(gltf.scene);
      if (drop) {
        for (const part of built) {
          part.geometry.dispose();
          part.material.dispose();
        }
        return;
      }
      setRoman(built);
    });
    return () => {
      drop = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      bodyMat.dispose();
      helmMat.dispose();
      bloodMat.dispose();
      bloodGeo.dispose();
    };
  }, [bodyMat, helmMat, bloodMat, bloodGeo]);

  useEffect(() => {
    return () => {
      knight?.body.dispose();
      knight?.helm.dispose();
    };
  }, [knight]);

  useEffect(() => {
    return () => {
      for (const part of roman ?? []) {
        part.geometry.dispose();
        part.material.dispose();
      }
    };
  }, [roman]);

  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const body = bodyRef.current;
    const helm = helmRef.current;
    const blood = bloodRef.current;
    if (body && helm) {
      for (let i = 0; i < WARS_FRIENDS; i++) {
        const p = warsKnight(i, t);
        const ease = p.fall * p.fall;
        const strike = p.fall > 0 ? 0 : Math.max(0, Math.sin(t * 8.4 + i));
        pose(p.x, p.z, p.yaw, p.fall, p.fall > 0 ? -1.38 * ease : -strike * 0.24, p.fall > 0 ? (i % 2 ? 0.22 : -0.22) * ease : 0);
        body.setMatrixAt(i, dummy.matrix);
        helm.setMatrixAt(i, dummy.matrix);
        if (blood) {
          dummy.rotation.order = "XYZ";
          dummy.position.set(p.x, 0.07, p.z);
          dummy.rotation.set(-Math.PI / 2, 0, p.yaw);
          dummy.scale.setScalar(p.fall > 0.05 ? 0.35 + ease * 1.15 : 0.0001);
          dummy.updateMatrix();
          blood.setMatrixAt(i, dummy.matrix);
        }
      }
      body.instanceMatrix.needsUpdate = true;
      helm.instanceMatrix.needsUpdate = true;
      if (blood) blood.instanceMatrix.needsUpdate = true;
    }
    if (!roman) return;
    for (let part = 0; part < roman.length; part++) {
      const mesh = romanRefs.current[part];
      if (!mesh) continue;
      for (let i = 0; i < WARS_FOES; i++) {
        const p = warsRoman(i, t);
        const ease = p.fall * p.fall;
        const strike = p.fall > 0 ? 0 : Math.max(0, Math.sin(t * 7.1 + i * 1.6));
        pose(p.x, p.z, p.yaw, p.fall, p.fall > 0 ? -1.32 * ease : -strike * 0.2, p.fall > 0 ? (i % 2 ? -0.18 : 0.18) * ease : 0);
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {knight && (
        <>
          <instancedMesh ref={bloodRef} args={[bloodGeo, bloodMat, WARS_FRIENDS]} frustumCulled={false} />
          <instancedMesh ref={bodyRef} args={[knight.body, bodyMat, WARS_FRIENDS]} frustumCulled={false} />
          <instancedMesh ref={helmRef} args={[knight.helm, helmMat, WARS_FRIENDS]} frustumCulled={false} />
        </>
      )}
      {roman?.map((part, i) => (
        <instancedMesh
          key={i}
          ref={(node) => {
            romanRefs.current[i] = node;
          }}
          args={[part.geometry, part.material, WARS_FOES]}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}

function WarsNames({ names }: { names: string[] }) {
  const labels = useMemo(() => {
    const out: { slot: number; text: string }[] = [];
    for (let i = 0; i < WARS_FRIENDS; i++) {
      const text = String(names[i] ?? "").trim().replace(/^@+/, "");
      if (text) out.push({ slot: i, text });
    }
    return out;
  }, [names]);
  const atlas = useMemo<NameAtlas>(
    () => buildNameAtlas(labels.map((n) => ({ text: n.text, commander: false, plain: true, fill: "#ffe14a" })), true),
    [labels]
  );
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const { camera } = useThree();

  useEffect(() => () => atlas.dispose(), [atlas]);

  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    for (let s = 0; s < atlas.sheets.length; s++) {
      const mesh = refs.current[s];
      if (!mesh) continue;
      for (let k = 0; k < labels.length; k++) {
        const cell: NameCell | undefined = atlas.cells[k];
        if (!cell || cell.sheet !== s) continue;
        const slot = labels[k].slot;
        const p = warsKnight(slot, t);
        const hide = p.fall > 0.72;
        dummy.quaternion.copy(camera.quaternion);
        dummy.rotateY(Math.PI);
        dummy.position.set(p.x, 1.92, p.z);
        dummy.scale.set(hide ? 0 : Math.min(1.15, cell.sx * NAME_S), hide ? 0 : cell.sy * NAME_S, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(cell.local, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {atlas.sheets.map((sheet, s) =>
        sheet.count > 0 ? (
          <instancedMesh
            key={s}
            ref={(node) => {
              refs.current[s] = node;
            }}
            args={[sheet.geometry, sheet.material, sheet.count]}
            frustumCulled={false}
            renderOrder={40}
          />
        ) : null
      )}
    </group>
  );
}

export function WarsBattle({ names }: { names: string[] }) {
  return (
    <group>
      <WarsGround />
      <WarsFighters />
      <WarsNames names={names} />
    </group>
  );
}
