import * as THREE from "three";

const ATLAS = 2048;

export type NameItem = {
  text: string;
  commander: boolean;
  plain?: boolean;
};

export type NameCell = {
  sheet: number;
  local: number;
  u: number;
  v: number;
  su: number;
  sv: number;
  sx: number;
  sy: number;
};

export type NameSheet = {
  map: THREE.CanvasTexture;
  material: THREE.ShaderMaterial;
  geometry: THREE.PlaneGeometry;
  count: number;
};

export type NameAtlas = {
  sheets: NameSheet[];
  cells: NameCell[];
  dispose: () => void;
};

const VERT = `
attribute vec4 uvRect;
varying vec2 vUv;
void main() {
  vUv = uv * uvRect.zw + uvRect.xy;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = `
uniform sampler2D map;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.08) discard;
  gl_FragColor = c;
}
`;

function pickCell(unique: number) {
  if (unique <= 400) return { w: 256, h: 64, font: 36, cmd: 42 };
  if (unique <= 1200) return { w: 192, h: 48, font: 26, cmd: 32 };
  return { w: 160, h: 40, font: 22, cmd: 26 };
}

function labelOf(item: NameItem) {
  const raw = String(item.text || "").trim().replace(/^@+/, "");
  if (!raw) return "";
  if (item.plain) return raw;
  return `@${raw}`;
}

function itemKey(item: NameItem) {
  return `${item.commander ? "c" : "n"}:${item.plain ? "p" : "a"}:${labelOf(item)}`;
}

function paintCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  commander: boolean,
  font: number,
  cmdFont: number
) {
  ctx.clearRect(x, y, w, h);
  if (!text) return 0;
  let size = commander ? cmdFont : font;
  ctx.font = `800 ${size}px Inter, Montserrat, Helvetica, Arial, sans-serif`;
  let tw = ctx.measureText(text).width;
  while (tw + 14 > w && size > 10) {
    size -= 1;
    ctx.font = `800 ${size}px Inter, Montserrat, Helvetica, Arial, sans-serif`;
    tw = ctx.measureText(text).width;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(5, size * 0.22);
  ctx.strokeStyle = commander ? "rgba(4, 22, 40, 0.96)" : "rgba(0,0,0,0.94)";
  ctx.fillStyle = commander ? "#2eb8d4" : "#fff";
  ctx.strokeText(text, x + w / 2, y + h / 2);
  ctx.fillText(text, x + w / 2, y + h / 2);
  return tw;
}

export function buildNameAtlas(items: NameItem[]): NameAtlas {
  if (!items.length) {
    return { sheets: [], cells: [], dispose() {} };
  }

  const unique: NameItem[] = [];
  const uniqueAt = new Map<string, number>();
  for (const item of items) {
    const k = itemKey(item);
    if (!uniqueAt.has(k)) {
      uniqueAt.set(k, unique.length);
      unique.push(item);
    }
  }

  const cell = pickCell(unique.length);
  const cols = Math.max(1, Math.floor(ATLAS / cell.w));
  const rowsMax = Math.max(1, Math.floor(ATLAS / cell.h));
  const per = cols * rowsMax;
  const sheetN = Math.max(1, Math.ceil(unique.length / per));
  const uniqueCells: Omit<NameCell, "local">[] = [];
  const sheets: NameSheet[] = [];
  const syBase = 0.74;

  for (let s = 0; s < sheetN; s++) {
    const start = s * per;
    const uCount = Math.min(per, unique.length - start);
    const usedCols = Math.min(cols, Math.max(1, uCount));
    const usedRows = Math.max(1, Math.ceil(Math.max(1, uCount) / cols));
    const texW = usedCols * cell.w;
    const texH = usedRows * cell.h;
    const canvas = document.createElement("canvas");
    canvas.width = texW;
    canvas.height = texH;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.clearRect(0, 0, texW, texH);
    for (let i = 0; i < uCount; i++) {
      const item = unique[start + i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const text = labelOf(item);
      const tw = paintCell(ctx, col * cell.w, row * cell.h, cell.w, cell.h, text, item.commander, cell.font, cell.cmd);
      const sy = item.commander ? syBase * 1.12 : syBase;
      const sx = Math.min(2.9, sy * Math.max(1.15, (tw + 18) / cell.h));
      uniqueCells.push({
        sheet: s,
        u: (col * cell.w) / texW,
        v: 1 - ((row + 1) * cell.h) / texH,
        su: cell.w / texW,
        sv: cell.h / texH,
        sx: item.commander ? sx * 1.06 : sx,
        sy,
      });
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.NoColorSpace;
    map.generateMipmaps = false;
    map.minFilter = THREE.LinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.wrapS = THREE.ClampToEdgeWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
    map.flipY = true;
    const material = new THREE.ShaderMaterial({
      uniforms: { map: { value: map } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    sheets.push({
      map,
      material,
      geometry: new THREE.PlaneGeometry(1, 1),
      count: 0,
    });
  }

  const instOf = sheets.map(() => 0);
  const cells: NameCell[] = [];
  for (const item of items) {
    const uCell = uniqueCells[uniqueAt.get(itemKey(item)) ?? 0];
    if (!uCell) continue;
    const local = instOf[uCell.sheet]++;
    cells.push({ ...uCell, local });
  }
  for (let s = 0; s < sheets.length; s++) {
    const count = Math.max(1, instOf[s]);
    sheets[s].count = instOf[s];
    const uvRect = new Float32Array(count * 4);
    for (const c of cells) {
      if (c.sheet !== s) continue;
      uvRect[c.local * 4] = c.u;
      uvRect[c.local * 4 + 1] = c.v;
      uvRect[c.local * 4 + 2] = c.su;
      uvRect[c.local * 4 + 3] = c.sv;
    }
    sheets[s].geometry.setAttribute("uvRect", new THREE.InstancedBufferAttribute(uvRect, 4));
  }

  return {
    sheets,
    cells,
    dispose() {
      for (const sh of sheets) {
        sh.map.dispose();
        sh.material.dispose();
        sh.geometry.dispose();
      }
    },
  };
}
