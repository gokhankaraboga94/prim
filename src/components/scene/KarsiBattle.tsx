import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { formatCount } from "../../game";
import { buildKnightSoldier } from "../../knightSoldier";
import { buildNameAtlas, type NameAtlas, type NameCell } from "../../nameAtlas";
import { REEL_HOLD } from "../../recordCanvas";
import { armUniforms, buildFoe, fitHero, installArmShader, paintArmWeights } from "./ArenaBattle";
import {
  KARSI_HERO_FOE,
  KARSI_HERO_ME,
  KARSI_ME,
  karsiCam,
  karsiChief,
  karsiEndAt,
  karsiFar,
  karsiFoe,
  karsiFriend,
  makeKarsiLayout,
  type KarsiChief,
  type KarsiLayout,
  type KarsiPose,
  type Rival,
} from "../../karsiReel";

const dummy = new THREE.Object3D();
const pose: KarsiPose = { x: 0, z: 0, yaw: 0, fall: 0, lift: 0, chop: 0 };
const chief: KarsiChief = { x: 0, z: 0, yaw: 0, kneel: 0, lift: 0, chop: 0 };
const ROMAN_H = 1.66;
/** buildFoe fits the roman to the arena height; the field armies stand taller. */
const ROMAN_SCALE = ROMAN_H / 1.22;
const CHIEF_H = 2.7;
/** fitHero fits heroes to 1.58. */
const CHIEF_SCALE = CHIEF_H / 1.58;
const NAME_Y = 2.94;

function upper(name: string) {
  return `@${name.replace(/^@+/, "").toUpperCase()}`;
}

function paintColor(geo: THREE.BufferGeometry, hex: string) {
  const c = new THREE.Color(hex);
  const n = geo.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

type Rig = { geo: THREE.BufferGeometry; material: THREE.Material; strike: THREE.InstancedBufferAttribute };

/** One draw per army: body, helm and sword merged so the sword swings with the arm. */
function rigKnight(root: THREE.Object3D, count: number): Rig | null {
  const parts = buildKnightSoldier(root);
  const body = paintColor(parts.body, "#1a56e8");
  const helm = paintColor(parts.helm, "#e7eef5");
  const geo = mergeGeometries([body, helm], false);
  body.dispose();
  helm.dispose();
  if (!geo) return null;
  const cut = paintArmWeights(geo, false);
  if (!cut) return null;
  const strike = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 2), 2);
  strike.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aStrike", strike);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.55, envMapIntensity: 0.9 });
  installArmShader(material, armUniforms(cut.side, cut.pivot, cut.elbow, false), "attribute vec2 aStrike;\nvec2 armStrike() { return aStrike; }", "karsi-knight-arm");
  return { geo, material, strike };
}

function rigRoman(root: THREE.Object3D, count: number): Rig | null {
  const geo = buildFoe(root);
  if (!geo) return null;
  const cut = paintArmWeights(geo, true);
  if (!cut) return null;
  const strike = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 2), 2);
  strike.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aStrike", strike);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.46, metalness: 0.4, envMapIntensity: 0.7 });
  installArmShader(material, armUniforms(cut.side, cut.pivot, cut.elbow, true), "attribute vec2 aStrike;\nvec2 armStrike() { return aStrike; }", "karsi-roman-arm");
  return { geo, material, strike };
}

function useRig(url: string, build: (root: THREE.Object3D, count: number) => Rig | null, count: number) {
  const [rig, setRig] = useState<Rig | null>(null);
  useEffect(() => {
    let drop = false;
    new GLTFLoader().load(url, (gltf) => {
      const next = build(gltf.scene, count);
      if (drop) {
        next?.geo.dispose();
        next?.material.dispose();
        return;
      }
      setRig(next);
    });
    return () => {
      drop = true;
    };
  }, [url, build, count]);
  useEffect(
    () => () => {
      rig?.geo.dispose();
      rig?.material.dispose();
    },
    [rig]
  );
  return rig;
}

function KarsiArmies({ layout }: { layout: KarsiLayout }) {
  const knight = useRig("/models/knight.glb", rigKnight, layout.us.n);
  const roman = useRig("/models/roman.glb", rigRoman, layout.them.n);
  const usRef = useRef<THREE.InstancedMesh>(null);
  const themRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    usRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    themRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, [knight, roman]);

  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    dummy.rotation.order = "YXZ";
    const us = usRef.current;
    for (let i = 0; i < layout.us.n; i++) {
      karsiFriend(layout, i, t, pose);
      layout.liveX[i] = pose.x;
      layout.liveZ[i] = pose.z;
      layout.liveFall[i] = pose.fall;
      if (!us || !knight) continue;
      dummy.position.set(pose.x, 0.05, pose.z);
      dummy.rotation.set(-1.45 * pose.fall, pose.yaw, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      us.setMatrixAt(i, dummy.matrix);
      knight.strike.setXY(i, pose.lift, pose.chop);
    }
    if (us && knight) {
      us.instanceMatrix.needsUpdate = true;
      knight.strike.needsUpdate = true;
    }
    const them = themRef.current;
    if (layout.invite) return;
    for (let i = 0; i < layout.them.n; i++) {
      karsiFoe(layout, i, t, pose);
      layout.foeX[i] = pose.x;
      layout.foeZ[i] = pose.z;
      layout.foeFall[i] = pose.fall;
      if (!them || !roman) continue;
      dummy.position.set(pose.x, 0.05, pose.z);
      dummy.rotation.set(0, Math.PI / 2, 1.45 * pose.fall);
      dummy.scale.setScalar(ROMAN_SCALE);
      dummy.updateMatrix();
      them.setMatrixAt(i, dummy.matrix);
      roman.strike.setXY(i, pose.lift, pose.chop);
    }
    if (them && roman) {
      them.instanceMatrix.needsUpdate = true;
      roman.strike.needsUpdate = true;
    }
  });

  return (
    <group>
      {knight && layout.us.n > 0 && <instancedMesh ref={usRef} args={[knight.geo, knight.material, layout.us.n]} frustumCulled={false} />}
      {!layout.invite && roman && layout.them.n > 0 && <instancedMesh ref={themRef} args={[roman.geo, roman.material, layout.them.n]} frustumCulled={false} />}
    </group>
  );
}

/** Follower names: yellow on black for us, red on black for the rival list. */
function KarsiNames({ names, layout, foe = false }: { names: string[]; layout: KarsiLayout; foe?: boolean }) {
  const count = foe ? layout.them.n : layout.us.n;
  const labels = useMemo(() => {
    const out: { slot: number; text: string }[] = [];
    for (let i = 0; i < count; i++) {
      const text = String(names[i] ?? "").trim().replace(/^@+/, "");
      if (text) out.push({ slot: i, text });
    }
    return out;
  }, [names, count]);
  const atlas = useMemo<NameAtlas>(() => {
    const items = labels.map((n) => ({ text: n.text, commander: false, plain: true, fill: foe ? "#ff2a22" : "#ffe14a", frame: true }));
    const sharp = items.length <= 80;
    const crisp = items.length <= 220;
    try {
      return buildNameAtlas(items, crisp, sharp);
    } catch {
      return buildNameAtlas(items);
    }
  }, [labels, foe]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const lookDir = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => () => atlas.dispose(), [atlas]);

  useFrame(({ camera }) => {
    const persp = camera as THREE.PerspectiveCamera;
    const fov = persp.isPerspectiveCamera ? persp.fov : 50;
    const tanH = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * (1080 / 1920);
    camera.getWorldDirection(lookDir);
    dummy.quaternion.copy(camera.quaternion);
    for (let k = 0; k < labels.length; k++) {
      const cell: NameCell | undefined = atlas.cells[k];
      const mesh = cell ? refs.current[cell.sheet] : null;
      if (!cell || !mesh) continue;
      const slot = labels[k].slot;
      const x = foe ? layout.foeX[slot] : layout.liveX[slot];
      const z = foe ? layout.foeZ[slot] : layout.liveZ[slot];
      const dx = x - camera.position.x;
      const dz = z - camera.position.z;
      const ahead = dx * lookDir.x + (NAME_Y - camera.position.y) * lookDir.y + dz * lookDir.z;
      const dist = Math.hypot(dx, camera.position.y - NAME_Y, dz);
      const hide = ahead < 2.4 || (foe ? layout.foeFall[slot] : layout.liveFall[slot]) > 0.35;
      const pitch = foe ? layout.them.spread : layout.us.spread;
      const want = Math.min(pitch * 1.08, dist * tanH * (foe ? 0.984 : 0.84));
      const size = want / Math.max(2.05, cell.sx);
      dummy.position.set(x, NAME_Y, z);
      dummy.scale.set(hide ? 0 : cell.sx * size, hide ? 0 : cell.sy * size, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(cell.local, dummy.matrix);
    }
    for (const mesh of refs.current) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function canvasTexture(canvas: HTMLCanvasElement) {
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = false;
  map.minFilter = THREE.LinearFilter;
  map.magFilter = THREE.LinearFilter;
  return map;
}

/** Commander tag: yellow on black for us, red on black for the rival. */
function chiefTag(text: string, foe = false) {
  const ink = foe ? "#ff2a22" : "#ffe14a";
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 200;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    let size = 128;
    ctx.font = `900 ${size}px Inter, sans-serif`;
    while (size > 40 && ctx.measureText(text).width > 900) {
      size -= 4;
      ctx.font = `900 ${size}px Inter, sans-serif`;
    }
    const w = Math.min(1004, ctx.measureText(text).width + 90);
    roundRect(ctx, (1024 - w) / 2, 14, w, 172, 34);
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, 104);
  }
  return canvasTexture(canvas);
}

function disposeScene(scene: THREE.Object3D) {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      (mat as THREE.MeshStandardMaterial).map?.dispose();
      mat.dispose();
    }
  });
}

function KarsiChiefUnit({ layout, mine, name }: { layout: KarsiLayout; mine: boolean; name: string }) {
  const [body, setBody] = useState<THREE.Group | null>(null);
  const node = useRef<THREE.Group>(null);
  const tag = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => chiefTag(upper(name), !mine), [name, mine]);
  useEffect(() => () => tex.dispose(), [tex]);
  useEffect(() => {
    let drop = false;
    new GLTFLoader().load(mine ? KARSI_HERO_ME : KARSI_HERO_FOE, (gltf) => {
      const fitted = fitHero(gltf.scene, 0, true);
      if (drop) {
        disposeScene(fitted);
        return;
      }
      setBody(fitted);
    });
    return () => {
      drop = true;
    };
  }, [mine]);
  useEffect(() => () => {
    if (body) disposeScene(body);
  }, [body]);
  const arms = useMemo(() => {
    const list: THREE.Vector2[] = [];
    body?.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.userData.armStrike) list.push(mesh.userData.armStrike as THREE.Vector2);
    });
    return list;
  }, [body]);
  useFrame(({ clock, camera }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    karsiChief(layout, mine, t, chief);
    const g = node.current;
    if (g) {
      g.position.set(chief.x, -0.55 * chief.kneel, chief.z);
      g.rotation.set(0.38 * chief.kneel * (mine ? 1 : -1), chief.yaw, 0);
    }
    for (const arm of arms) arm.set(chief.lift, chief.chop);
    const plate = tag.current;
    if (plate) {
      plate.position.set(chief.x, CHIEF_H + 0.75 - 0.55 * chief.kneel, chief.z);
      plate.quaternion.copy(camera.quaternion);
    }
  });
  return (
    <group>
      <group ref={node}>
        <group scale={CHIEF_SCALE}>{body && <primitive object={body} />}</group>
      </group>
      <mesh ref={tag} renderOrder={45}>
        <planeGeometry args={[4.6, 0.9]} />
        <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function KarsiHud({ layout, rival }: { layout: KarsiLayout; rival: string }) {
  const size = useThree((s) => s.size);
  const score = useRef<THREE.Mesh>(null);
  const banner = useRef<THREE.Mesh>(null);
  const scoreTex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 420;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      roundRect(ctx, 28, 28, 1992, 364, 48);
      ctx.fillStyle = "rgba(8, 4, 2, 0.86)";
      ctx.fill();
      ctx.lineWidth = 22;
      ctx.strokeStyle = "#ffe14a";
      ctx.stroke();
      const parts = layout.invite
        ? [
            { text: formatCount(layout.us.real), font: 150, fill: "#ffe14a" },
            { text: ` ${upper(KARSI_ME)}  `, font: 66, fill: "#fff4c4" },
            { text: "HAZIR", font: 120, fill: "#ffffff" },
          ]
        : [
        { text: formatCount(layout.them.real), font: 150, fill: "#ff3b30" },
        { text: ` ${upper(rival)}  `, font: 66, fill: "#ff2a22" },
        { text: "VS", font: 120, fill: "#ffffff" },
        { text: `  ${formatCount(layout.us.real)}`, font: 150, fill: "#ffe14a" },
        { text: ` ${upper(KARSI_ME)}`, font: 66, fill: "#fff4c4" },
      ];
      let scale = 1;
      const widthAt = (s: number) => {
        let sum = 0;
        for (const part of parts) {
          ctx.font = `900 ${Math.round(part.font * s)}px Inter, sans-serif`;
          sum += ctx.measureText(part.text).width;
        }
        return sum;
      };
      while (scale > 0.4 && widthAt(scale) > 1880) scale -= 0.02;
      let cursor = (2048 - widthAt(scale)) / 2;
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      for (const part of parts) {
        const font = Math.round(part.font * scale);
        ctx.font = `900 ${font}px Inter, sans-serif`;
        const tw = ctx.measureText(part.text).width;
        if (part.text === "VS") {
          roundRect(ctx, cursor - 8, 210 - font * 0.48, tw + 16, font * 0.96, 22);
          ctx.fillStyle = "#c41616";
          ctx.fill();
        }
        ctx.lineWidth = Math.max(8, font * 0.09);
        ctx.strokeStyle = "rgba(0,0,0,0.9)";
        ctx.strokeText(part.text, cursor, 210);
        ctx.fillStyle = part.fill;
        ctx.fillText(part.text, cursor, 210);
        cursor += tw;
      }
    }
    return canvasTexture(canvas);
  }, [layout.invite, layout.them.real, layout.us.real, rival]);
  const bannerTex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const winner = layout.weWin ? upper(KARSI_ME) : upper(rival);
      const loser = layout.weWin ? upper(rival) : upper(KARSI_ME);
      roundRect(ctx, 28, 28, 1992, 584, 56);
      ctx.fillStyle = "rgba(0, 0, 0, 0.86)";
      ctx.fill();
      ctx.lineWidth = 22;
      ctx.strokeStyle = "#ffe14a";
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const line = (text: string, y: number, font: number, fill: string) => {
        let s = font;
        ctx.font = `900 ${s}px Inter, sans-serif`;
        while (s > 40 && ctx.measureText(text).width > 1880) {
          s -= 4;
          ctx.font = `900 ${s}px Inter, sans-serif`;
        }
        ctx.fillStyle = fill;
        ctx.fillText(text, 1024, y);
      };
      if (layout.invite) {
        line("YORUMA ⚔️", 190, 180, "#ffe14a");
        line("CESARETİN VARSA BIRAK", 360, 92, "#ffffff");
        line("GÜÇLÜ OLAN KAZANIR", 500, 80, "#ffb020");
      } else {
        line("ZAFER", 150, 190, "#ffe14a");
        line(winner, 310, 130, "#ffffff");
        line(`${loser} ORDUSU RÖVANŞ İSTİYOR ⚔️`, 490, 92, "#ffb020");
      }
    }
    return canvasTexture(canvas);
  }, [layout.invite, layout.weWin, rival]);
  useEffect(() => () => scoreTex.dispose(), [scoreTex]);
  useEffect(() => () => bannerTex.dispose(), [bannerTex]);
  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const pulse = 1 + Math.sin(t * 3.4) * 0.04;
    score.current?.scale.set(pulse, pulse, 1);
    const show = Math.max(0, Math.min(1, (t - karsiEndAt(layout.invite) - 0.9) / 0.5));
    const b = banner.current;
    if (b) {
      b.visible = show > 0;
      (b.material as THREE.MeshBasicMaterial).opacity = show;
      const pop = 0.86 + 0.14 * show;
      b.scale.set(pop, pop, 1);
    }
  });
  const w = size.width * 0.96;
  const h = w * (420 / 2048);
  const bh = w * (640 / 2048);
  return (
    <Hud renderPriority={3}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh ref={score} position={[0, size.height / 2 - h * 0.5 - 22, 4]} renderOrder={30}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={scoreTex} transparent depthTest={false} toneMapped={false} />
      </mesh>
      <mesh ref={banner} position={[0, -size.height * 0.18, 4]} renderOrder={31} visible={false}>
        <planeGeometry args={[w, bh]} />
        <meshBasicMaterial map={bannerTex} transparent opacity={0} depthTest={false} toneMapped={false} />
      </mesh>
    </Hud>
  );
}

export function useKarsiLayout(soldiers: number, rival: Rival) {
  return useMemo(() => makeKarsiLayout(soldiers, rival.foes, Boolean(rival.invite)), [soldiers, rival.foes, rival.invite]);
}

export function KarsiCam({ soldiers, rival }: { soldiers: number; rival: Rival }) {
  const layout = useKarsiLayout(soldiers, rival);
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera, clock }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = karsiCam(layout, Math.max(0, clock.elapsedTime - REEL_HOLD));
    persp.fov = shot.fov;
    persp.near = 0.35;
    persp.far = karsiFar(layout);
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

export function KarsiBattle({ names, soldiers, rival }: { names: string[]; soldiers: number; rival: Rival }) {
  const layout = useKarsiLayout(soldiers, rival);
  return (
    <group>
      <KarsiHud layout={layout} rival={rival.name} />
      <KarsiArmies layout={layout} />
      <KarsiNames names={names} layout={layout} />
      {!!rival.foeNames?.length && <KarsiNames names={rival.foeNames} layout={layout} foe />}
      <KarsiChiefUnit layout={layout} mine name={KARSI_ME} />
      {!layout.invite && <KarsiChiefUnit layout={layout} mine={false} name={rival.name} />}
    </group>
  );
}
