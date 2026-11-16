import * as THREE from "three";

export type MafyaGun = "pistol" | "m4" | "leader";

export function mafyaGunKind(num: number): MafyaGun {
  if (num === 1 || num === 6) return "leader";
  if (num === 8) return "m4";
  return num % 2 === 1 ? "m4" : "pistol";
}

function metal(color: string, metalness = 0.9, roughness = 0.28) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    envMapIntensity: 1.15,
  });
}

function matte(color: string) {
  return new THREE.MeshLambertMaterial({ color });
}

function addBox(parent: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, rx = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  if (rx) mesh.rotation.x = rx;
  parent.add(mesh);
  return mesh;
}

function addCyl(parent: THREE.Object3D, rTop: number, rBot: number, len: number, seg: number, mat: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, seg), mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** 1911 / modern yarı otomatik — mafya-4 vb. tabanca */
export function makePistol(simple = false) {
  const g = new THREE.Group();
  g.name = "mafyaPistol";
  const seg = simple ? 6 : 12;
  const slide = simple ? matte("#b8c0c8") : metal("#b8c0c8", 0.96, 0.16);
  const frame = simple ? matte("#3a3e44") : metal("#2e3238", 0.82, 0.34);
  const black = simple ? matte("#1a1c20") : metal("#16181c", 0.7, 0.42);
  const chrome = simple ? matte("#d4dae0") : metal("#d8dee4", 0.98, 0.1);
  const grip = simple ? matte("#3a2a20") : metal("#342418", 0.22, 0.68);

  // Slide
  addBox(g, 0.042, 0.055, 0.178, slide, 0, 0.042, 0.06);
  // Slide serrations (rear)
  for (let i = 0; i < 6; i++) {
    addBox(g, 0.044, 0.04, 0.006, black, 0, 0.042, -0.01 + i * 0.01);
  }
  // Ejection port
  addBox(g, 0.01, 0.028, 0.055, black, 0.018, 0.048, 0.05);
  // Barrel in port + muzzle
  addCyl(g, 0.01, 0.01, 0.12, seg, chrome, 0, 0.04, 0.14);
  addCyl(g, 0.013, 0.011, 0.028, seg, chrome, 0, 0.04, 0.205);
  // Frame / dust cover
  addBox(g, 0.04, 0.038, 0.14, frame, 0, 0.01, 0.045);
  addBox(g, 0.038, 0.022, 0.06, frame, 0, 0.0, 0.12); // dust cover forward
  // Trigger guard + trigger
  addBox(g, 0.032, 0.004, 0.045, frame, 0, -0.012, 0.035);
  addBox(g, 0.004, 0.028, 0.035, frame, 0.014, -0.024, 0.035);
  addBox(g, 0.004, 0.028, 0.035, frame, -0.014, -0.024, 0.035);
  addBox(g, 0.012, 0.028, 0.01, chrome, 0, -0.008, 0.04, 0.15);
  // Mag well + magazine
  addBox(g, 0.036, 0.02, 0.04, frame, 0, -0.02, 0.01);
  addBox(g, 0.032, 0.1, 0.038, black, 0, -0.07, 0.008, 0.08);
  addBox(g, 0.034, 0.012, 0.04, chrome, 0, -0.12, 0.005); // mag floor
  // Grip panels
  addBox(g, 0.038, 0.1, 0.05, grip, 0, -0.055, 0.0, 0.2);
  addBox(g, 0.006, 0.08, 0.042, black, 0.018, -0.055, 0.0, 0.2);
  addBox(g, 0.006, 0.08, 0.042, black, -0.018, -0.055, 0.0, 0.2);
  // Beavertail / backstrap
  addBox(g, 0.034, 0.04, 0.02, frame, 0, -0.02, -0.028, -0.25);
  // Hammer
  addBox(g, 0.014, 0.022, 0.018, chrome, 0, 0.055, -0.03);
  // Sights
  addBox(g, 0.024, 0.016, 0.022, black, 0, 0.072, -0.015); // rear
  addBox(g, 0.008, 0.014, 0.014, chrome, 0.008, 0.078, -0.012);
  addBox(g, 0.008, 0.014, 0.014, chrome, -0.008, 0.078, -0.012);
  addBox(g, 0.01, 0.016, 0.018, chrome, 0, 0.072, 0.135); // front
  // Slide stop / safety hints
  addBox(g, 0.008, 0.01, 0.028, chrome, 0.022, 0.02, 0.02);
  addBox(g, 0.006, 0.012, 0.016, black, 0.022, 0.035, -0.02);

  const tip = new THREE.Object3D();
  tip.name = "muzzle";
  tip.position.set(0, 0.04, 0.23);
  g.add(tip);
  g.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  g.position.set(0.02, 0.06, 0.04);
  g.scale.setScalar(1.12);
  return g;
}

/** Standart M4 / AR çizgisi */
export function makeM4(simple = false) {
  const g = new THREE.Group();
  g.name = "mafyaM4";
  const steel = simple ? matte("#aeb6be") : metal("#aeb6be", 0.92, 0.26);
  const dark = simple ? matte("#4a525a") : metal("#3e464e", 0.85, 0.35);
  const polymer = simple ? matte("#2c3034") : metal("#262a2e", 0.35, 0.55);

  addBox(g, 0.048, 0.07, 0.22, steel, 0, 0.03, 0.06); // receiver
  addBox(g, 0.042, 0.045, 0.14, dark, 0, 0.028, 0.2); // handguard
  addCyl(g, 0.01, 0.012, 0.28, simple ? 6 : 10, dark, 0, 0.035, 0.36);
  addCyl(g, 0.016, 0.014, 0.045, simple ? 6 : 8, dark, 0, 0.035, 0.5); // flash hider
  addBox(g, 0.032, 0.13, 0.048, steel, 0, -0.055, 0.05); // mag
  addBox(g, 0.038, 0.065, 0.13, polymer, 0, 0.02, -0.12); // stock
  addBox(g, 0.04, 0.075, 0.02, polymer, 0, 0.02, -0.19); // butt
  addBox(g, 0.032, 0.09, 0.04, polymer, 0, -0.04, -0.01, 0.35); // grip
  addBox(g, 0.04, 0.012, 0.16, dark, 0, 0.07, 0.08); // rail
  addBox(g, 0.018, 0.028, 0.03, dark, 0, 0.085, 0.14); // rear sight
  addBox(g, 0.014, 0.024, 0.02, dark, 0, 0.08, 0.28); // front sight

  const tip = new THREE.Object3D();
  tip.name = "muzzle";
  tip.position.set(0, 0.035, 0.54);
  g.add(tip);
  g.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  g.position.set(0.03, 0.08, 0.05);
  g.scale.setScalar(0.92);
  return g;
}

/**
 * Lider (1 / 6): daha gerçekçi, siyah + hafif krom detaylı karabina.
 */
export function makeLeaderRifle(simple = false) {
  const g = new THREE.Group();
  g.name = "mafyaLeader";
  const black = simple ? matte("#1c1e22") : metal("#1a1c20", 0.78, 0.38);
  const steel = simple ? matte("#9aa3ac") : metal("#9aa3ac", 0.96, 0.18);
  const chrome = simple ? matte("#d0d6dc") : metal("#d8dee4", 0.98, 0.12);
  const wood = simple ? matte("#4a3428") : metal("#3e2c22", 0.28, 0.62);

  // Lower + upper receiver
  addBox(g, 0.046, 0.062, 0.2, black, 0, 0.028, 0.05);
  addBox(g, 0.044, 0.038, 0.17, steel, 0, 0.055, 0.055);
  // Dust cover / ejection hint
  addBox(g, 0.006, 0.02, 0.06, chrome, 0.024, 0.048, 0.07);
  // Picatinny rail
  for (let i = 0; i < 7; i++) {
    addBox(g, 0.036, 0.008, 0.012, black, 0, 0.078, -0.02 + i * 0.028);
  }
  // Carry handle / optic mount
  addBox(g, 0.03, 0.035, 0.08, black, 0, 0.1, 0.04);
  addBox(g, 0.022, 0.012, 0.05, chrome, 0, 0.12, 0.04);
  // Handguard (hex-ish with vents)
  addBox(g, 0.04, 0.048, 0.17, black, 0, 0.03, 0.21);
  addBox(g, 0.034, 0.01, 0.15, steel, 0, 0.056, 0.21);
  for (let i = 0; i < 4; i++) {
    addBox(g, 0.008, 0.016, 0.02, black, 0.018, 0.03, 0.15 + i * 0.035);
    addBox(g, 0.008, 0.016, 0.02, black, -0.018, 0.03, 0.15 + i * 0.035);
  }
  // Barrel + gas block + flash hider
  addCyl(g, 0.008, 0.009, 0.3, simple ? 8 : 12, steel, 0, 0.038, 0.4);
  addBox(g, 0.028, 0.03, 0.035, black, 0, 0.05, 0.3); // gas block
  addCyl(g, 0.014, 0.011, 0.05, simple ? 8 : 10, chrome, 0, 0.038, 0.56); // flash
  addCyl(g, 0.016, 0.016, 0.012, 8, black, 0, 0.038, 0.53);
  // Magazine (curved look via tilt)
  const mag = addBox(g, 0.03, 0.14, 0.045, black, 0, -0.06, 0.045, 0.12);
  mag.rotation.z = 0.04;
  // Pistol grip
  addBox(g, 0.03, 0.095, 0.038, wood, 0, -0.048, -0.02, 0.42);
  // Collapsible stock
  addBox(g, 0.034, 0.04, 0.1, black, 0, 0.03, -0.1);
  addCyl(g, 0.01, 0.01, 0.08, 8, steel, 0, 0.03, -0.16);
  addBox(g, 0.042, 0.078, 0.028, black, 0, 0.02, -0.21);
  addBox(g, 0.046, 0.082, 0.01, wood, 0, 0.02, -0.228); // buttpad
  // Front / rear iron
  addBox(g, 0.016, 0.032, 0.018, chrome, 0, 0.09, 0.32);
  addBox(g, 0.02, 0.028, 0.022, chrome, 0, 0.095, -0.01);
  // Trigger guard
  addBox(g, 0.028, 0.004, 0.04, steel, 0, -0.01, 0.0);

  const tip = new THREE.Object3D();
  tip.name = "muzzle";
  tip.position.set(0, 0.038, 0.6);
  g.add(tip);
  g.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  g.position.set(0.028, 0.075, 0.045);
  g.scale.setScalar(0.95);
  return g;
}

export function makeMafyaGun(kind: MafyaGun, simple = false) {
  if (kind === "leader") return makeLeaderRifle(simple);
  if (kind === "m4") return makeM4(simple);
  return makePistol(simple);
}
