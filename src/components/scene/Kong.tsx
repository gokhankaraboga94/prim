import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { REEL_HOLD } from "../../recordCanvas";
import { devMaceSwing } from "../../devReel";

const HEIGHT = 15.6;
const up = new THREE.Vector3(0, 1, 0);
const aim = new THREE.Vector3();

function put(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = 1,
  sz = 1
) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.scale.set(sx, sy, sz);
  mesh.frustumCulled = false;
  parent.add(mesh);
  return mesh;
}

function spike(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
  len: number,
  rad: number
) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  aim.set(dx, dy, dz);
  if (aim.lengthSq() < 1e-6) aim.set(0, 1, 0);
  mesh.quaternion.setFromUnitVectors(up, aim.normalize());
  mesh.scale.set(rad, len, rad);
  mesh.frustumCulled = false;
  parent.add(mesh);
}

function furRing(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  count: number,
  len: number,
  tilt = 0.35
) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    spike(parent, geo, mat, cx + dx * radius, cy, cz + dz * radius * 0.72, dx, tilt, dz * 0.72, len, len * 0.22);
  }
}

function buildKong() {
  const fur = new THREE.MeshStandardMaterial({ color: "#6a6560", roughness: 0.96, metalness: 0.02 });
  const skin = new THREE.MeshStandardMaterial({ color: "#7c776f", roughness: 0.55, metalness: 0.06 });
  const ink = new THREE.MeshStandardMaterial({ color: "#241e1c", roughness: 0.72 });
  const tooth = new THREE.MeshStandardMaterial({ color: "#f4efe6", roughness: 0.32 });
  const scar = new THREE.MeshStandardMaterial({ color: "#3e3a36", roughness: 0.8 });
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cone = new THREE.ConeGeometry(1, 1, 5);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  put(body, sphere, fur, 0, 1.02, -0.02, 0, 0, 0, 0.72, 0.48, 0.55);
  put(body, sphere, skin, 0, 1.22, 0.16, 0, 0, 0, 0.58, 0.42, 0.42);
  put(body, sphere, skin, 0, 1.52, 0.2, 0.15, 0, 0, 0.78, 0.58, 0.48);
  put(body, sphere, skin, -0.28, 1.62, 0.38, 0, 0, 0.2, 0.34, 0.28, 0.22);
  put(body, sphere, skin, 0.28, 1.62, 0.38, 0, 0, -0.2, 0.34, 0.28, 0.22);
  put(body, box, scar, -0.05, 1.58, 0.52, 0.3, 0.4, 0.7, 0.46, 0.025, 0.02);
  put(body, box, scar, 0.12, 1.42, 0.48, -0.2, -0.3, 0.5, 0.32, 0.02, 0.02);
  put(body, sphere, fur, 0, 1.48, -0.28, 0, 0, 0, 0.7, 0.62, 0.42);
  for (let i = 0; i < 7; i++) {
    const y = 1.15 + i * 0.1;
    spike(body, cone, fur, 0, y, -0.55, 0, 0.25, -1, 0.38, 0.08);
  }
  spike(body, cone, fur, 0, 0.92, -0.42, 0, -0.2, -1, 0.28, 0.07);

  const leg = (side: number) => {
    put(body, sphere, fur, side * 0.42, 0.92, 0.02, 0, 0, 0, 0.34, 0.28, 0.32);
    put(body, sphere, fur, side * 0.46, 0.55, 0.04, 0.08, 0, side * 0.04, 0.28, 0.42, 0.26);
    put(body, sphere, skin, side * 0.48, 0.28, 0.06, 0, 0, 0, 0.2, 0.32, 0.2);
    put(body, box, skin, side * 0.5, 0.08, 0.16, 0, 0, 0, 0.42, 0.1, 0.62);
    for (let t = 0; t < 4; t++) {
      put(body, box, skin, side * 0.5 + (t - 1.5) * 0.08, 0.05, 0.46, 0.2, 0, 0, 0.07, 0.05, 0.16);
    }
    furRing(body, cone, fur, side * 0.46, 0.7, 0.02, 0.22, 8, 0.22, 0.15);
  };
  leg(-1);
  leg(1);

  const hang = (parent: THREE.Object3D, side: number) => {
    put(parent, sphere, fur, side * 0.15, -0.35, 0.05, 0.2, 0, side * 0.2, 0.28, 0.55, 0.28);
    put(parent, sphere, fur, side * 0.22, -0.95, 0.12, 0.35, 0, side * 0.08, 0.22, 0.5, 0.22);
    put(parent, sphere, skin, side * 0.2, -1.38, 0.16, 0.4, 0, 0, 0.2, 0.18, 0.16);
    for (let f = 0; f < 4; f++) {
      put(parent, box, skin, side * 0.2 + (f - 1.5) * 0.06, -1.5, 0.24, 0.9, 0, 0, 0.045, 0.1, 0.05);
    }
    furRing(parent, cone, fur, side * 0.16, -0.45, 0.05, 0.2, 8, 0.28, 0.2);
  };

  put(body, sphere, fur, 1.05, 1.72, 0.02, 0, 0, -0.4, 0.48, 0.38, 0.42);
  const quiet = new THREE.Group();
  quiet.position.set(1.05, 1.72, 0.02);
  body.add(quiet);
  hang(quiet, 1);

  const arm = new THREE.Group();
  arm.position.set(-1.05, 1.72, 0.02);
  body.add(arm);
  put(arm, sphere, fur, 0, 0, 0, 0, 0, 0.4, 0.5, 0.4, 0.44);
  hang(arm, -1);

  const head = new THREE.Group();
  head.position.set(0, 2.02, 0.28);
  head.rotation.x = 0.22;
  body.add(head);
  put(head, sphere, fur, 0, 0.08, -0.06, 0, 0, 0, 0.34, 0.3, 0.3);
  put(head, sphere, skin, 0, -0.02, 0.1, 0, 0, 0, 0.26, 0.22, 0.2);
  put(head, box, skin, 0, 0.08, 0.16, 0.15, 0, 0, 0.42, 0.1, 0.16);
  put(head, box, ink, 0, -0.08, 0.24, 0.35, 0, 0, 0.28, 0.16, 0.12);
  put(head, sphere, skin, 0, -0.16, 0.2, 0.4, 0, 0, 0.18, 0.1, 0.14);
  put(head, sphere, ink, -0.09, 0.02, 0.22, 0, 0, 0, 0.045, 0.035, 0.03);
  put(head, sphere, ink, 0.09, 0.02, 0.22, 0, 0, 0, 0.045, 0.035, 0.03);
  put(head, box, skin, 0, -0.02, 0.26, 0.2, 0, 0, 0.1, 0.06, 0.08);
  put(head, cone, tooth, -0.06, -0.02, 0.3, Math.PI, 0, 0.1, 0.028, 0.16, 0.028);
  put(head, cone, tooth, 0.06, -0.02, 0.3, Math.PI, 0, -0.1, 0.028, 0.16, 0.028);
  put(head, cone, tooth, -0.05, -0.16, 0.26, 0.15, 0, 0, 0.022, 0.1, 0.022);
  put(head, cone, tooth, 0.05, -0.16, 0.26, 0.15, 0, 0, 0.022, 0.1, 0.022);
  for (let i = 0; i < 4; i++) {
    put(head, box, tooth, -0.1 + i * 0.055, -0.04, 0.3, 0, 0, 0, 0.03, 0.045, 0.02);
  }
  put(head, sphere, fur, -0.28, 0.02, 0, 0, 0, 0.4, 0.08, 0.12, 0.05);
  put(head, sphere, fur, 0.28, 0.02, 0, 0, 0, -0.4, 0.08, 0.12, 0.05);
  furRing(head, cone, fur, 0, 0.12, 0, 0.28, 14, 0.32, 0.55);
  for (let i = 0; i < 8; i++) {
    const a = -0.8 + (i / 7) * 1.6;
    spike(head, cone, fur, Math.sin(a) * 0.22, -0.12, 0.12, Math.sin(a), -0.8, 0.2, 0.28, 0.05);
  }

  put(body, sphere, fur, -1.15, 1.78, -0.08, 0, 0, 0.5, 0.55, 0.32, 0.4);
  put(body, sphere, fur, 1.15, 1.78, -0.08, 0, 0, -0.5, 0.55, 0.32, 0.4);
  furRing(body, cone, fur, -1.15, 1.85, 0, 0.28, 10, 0.42, 0.45);
  furRing(body, cone, fur, 1.15, 1.85, 0, 0.28, 10, 0.42, 0.45);

  const box3 = new THREE.Box3().setFromObject(root);
  const span = Math.max(0.001, box3.max.y - box3.min.y);
  const fit = HEIGHT / span;
  root.scale.setScalar(fit);
  root.position.y = -box3.min.y * fit;
  root.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(root);
  root.position.x -= (fitted.min.x + fitted.max.x) / 2;
  root.position.z -= (fitted.min.z + fitted.max.z) / 2;

  return {
    root,
    arm,
    dispose() {
      fur.dispose();
      skin.dispose();
      ink.dispose();
      tooth.dispose();
      scar.dispose();
      sphere.dispose();
      box.dispose();
      cone.dispose();
    },
  };
}

export function KongModel({ soldiers }: { soldiers: number }) {
  const built = useMemo(() => buildKong(), []);
  useEffect(() => () => built.dispose(), [built]);
  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const s = devMaceSwing(t, soldiers);
    built.arm.rotation.x = -s.pitch * 0.9;
    built.arm.rotation.y = -s.twist * 0.35;
    built.arm.rotation.z = s.sweep * 0.28;
  });
  return <primitive object={built.root} />;
}
