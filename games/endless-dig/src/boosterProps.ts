/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Shaft coin meshes: dirt boosters + rare special collectibles.
 */
import {
  CanvasTexture,
  CylinderGeometry,
  Group,
  LinearFilter,
  Mesh,
  MeshLambertMaterial,
  Raycaster,
  SRGBColorSpace,
  Vector2,
  type Camera,
  type Material,
  type Object3D,
} from "three";
import {
  visibleBoosters,
  type BoosterProgress,
  type BoosterValue,
  type DirtBooster,
} from "./boosters.js";
import {
  getSpecialCoinDef,
  visibleSpecialCoins,
  type SpecialCoinPlacement,
  type SpecialCoinProgress,
} from "./specialCoins.js";

export type ShaftCoinPick =
  | { kind: "dirt"; id: string }
  | { kind: "special"; id: string };

export interface BoosterProps {
  sync(
    excavatedDepth: number,
    worldSeed: number,
    boosters: BoosterProgress,
    special: SpecialCoinProgress,
  ): void;
  /** NDC pick (−1…1). */
  pick(camera: Camera, ndcX: number, ndcY: number): ShaftCoinPick | null;
  update(dtSeconds: number): void;
  dispose(): void;
}

const VALUE_FACE: Record<BoosterValue, number> = {
  50: 0xc4a85a,
  100: 0xd4b24a,
  200: 0xe8c84a,
  500: 0xffe08a,
};

const TEX_SIZE = 128;

function hexCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

function darkerGoldCss(faceHex: number): string {
  const r = Math.round(((faceHex >> 16) & 0xff) * 0.62);
  const g = Math.round(((faceHex >> 8) & 0xff) * 0.58);
  const b = Math.round((faceHex & 0xff) * 0.45);
  return hexCss((r << 16) | (g << 8) | b);
}

function makeLabeledCoinTexture(
  faceHex: number,
  label: string,
  ringScale = 0.08,
): CanvasTexture {
  const face = hexCss(faceHex);
  const ink = darkerGoldCss(faceHex);
  const canvas = document.createElement("canvas");
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable for coin texture");

  const cx = TEX_SIZE / 2;
  const cy = TEX_SIZE / 2;
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);

  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(cx, cy, TEX_SIZE * 0.48, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = ink;
  ctx.lineWidth = TEX_SIZE * ringScale;
  ctx.beginPath();
  ctx.arc(cx, cy, TEX_SIZE * 0.42, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = TEX_SIZE * 0.018;
  ctx.beginPath();
  ctx.arc(cx, cy, TEX_SIZE * 0.32, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontPx =
    label.length >= 3 ? TEX_SIZE * 0.28 : TEX_SIZE * (label.length === 1 ? 0.4 : 0.34);
  ctx.font = `700 ${fontPx}px "Segoe UI", "Helvetica Neue", ui-sans-serif, sans-serif`;
  ctx.fillText(label, cx, cy + TEX_SIZE * 0.02);

  const tex = new CanvasTexture(canvas);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const dirtTexCache = new Map<BoosterValue, CanvasTexture>();
const specialTexCache = new Map<string, CanvasTexture>();

function dirtFaceTexture(value: BoosterValue): CanvasTexture {
  let tex = dirtTexCache.get(value);
  if (!tex) {
    tex = makeLabeledCoinTexture(VALUE_FACE[value], String(value));
    dirtTexCache.set(value, tex);
  }
  return tex;
}

function specialFaceTexture(id: string, tint: number, mark: string): CanvasTexture {
  let tex = specialTexCache.get(id);
  if (!tex) {
    tex = makeLabeledCoinTexture(tint, mark, 0.1);
    specialTexCache.set(id, tex);
  }
  return tex;
}

function materialsForMap(
  faceHex: number,
  map: CanvasTexture,
  hot: boolean,
): MeshLambertMaterial[] {
  const side = new MeshLambertMaterial({
    color: faceHex,
    emissive: faceHex,
    emissiveIntensity: hot ? 0.14 : 0.06,
  });
  const cap = new MeshLambertMaterial({
    map,
    emissive: faceHex,
    emissiveIntensity: hot ? 0.12 : 0.05,
  });
  return [side, cap, cap.clone()];
}

function buildDirtCoin(b: DirtBooster): Mesh {
  const mesh = new Mesh(
    new CylinderGeometry(0.24, 0.24, 0.06, 24),
    materialsForMap(VALUE_FACE[b.value], dirtFaceTexture(b.value), b.value >= 200),
  );
  mesh.name = `dirt-${b.id}`;
  mesh.userData.coinKind = "dirt";
  mesh.userData.coinId = b.id;
  const baseY = 1 - b.depth + 0.35;
  mesh.userData.baseY = baseY;
  mesh.rotation.x = Math.PI / 2;
  mesh.frustumCulled = false;
  mesh.position.set(b.x, baseY, b.z);
  return mesh;
}

function buildSpecialCoin(c: SpecialCoinPlacement): Mesh {
  const def = getSpecialCoinDef(c.id);
  const tint = def?.tint ?? 0xc4a050;
  const mark = def?.mark ?? "?";
  const mesh = new Mesh(
    new CylinderGeometry(0.28, 0.28, 0.07, 24),
    materialsForMap(tint, specialFaceTexture(c.id, tint, mark), true),
  );
  mesh.name = `special-${c.id}`;
  mesh.userData.coinKind = "special";
  mesh.userData.coinId = c.id;
  const baseY = 1 - c.depth + 0.4;
  mesh.userData.baseY = baseY;
  mesh.rotation.x = Math.PI / 2;
  mesh.frustumCulled = false;
  mesh.position.set(c.x, baseY, c.z);
  return mesh;
}

function disposeMaterial(m: Material): void {
  m.dispose();
}

function disposeObject(obj: Object3D): void {
  obj.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry?.dispose();
    const m = child.material;
    if (Array.isArray(m)) m.forEach(disposeMaterial);
    else if (m) disposeMaterial(m);
  });
}

function disposeFaceTextures(): void {
  for (const tex of dirtTexCache.values()) tex.dispose();
  dirtTexCache.clear();
  for (const tex of specialTexCache.values()) tex.dispose();
  specialTexCache.clear();
}

function meshKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

export function createBoosterProps(parent: Object3D): BoosterProps {
  const root = new Group();
  root.name = "booster-props";
  parent.add(root);

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  let spin = 0;

  const clear = (): void => {
    while (root.children.length > 0) {
      const child = root.children[0]!;
      root.remove(child);
      disposeObject(child);
    }
  };

  const applySpinPose = (child: Object3D): void => {
    child.rotation.z = spin;
    const base = child.userData.baseY;
    if (typeof base === "number") {
      child.position.y = base + Math.sin(spin * 2 + base * 0.7) * 0.05;
    }
  };

  return {
    sync(excavatedDepth, worldSeed, boosters, special): void {
      const dirt = visibleBoosters(boosters, worldSeed, excavatedDepth);
      const rare = visibleSpecialCoins(special, worldSeed, excavatedDepth);
      const wanted = new Set<string>([
        ...dirt.map((b) => meshKey("dirt", b.id)),
        ...rare.map((c) => meshKey("special", c.id)),
      ]);
      const existing = new Map<string, Object3D>();
      for (const child of [...root.children]) {
        const kind = child.userData.coinKind;
        const id = child.userData.coinId;
        const key =
          typeof kind === "string" && typeof id === "string"
            ? meshKey(kind, id)
            : "";
        if (!key || !wanted.has(key)) {
          root.remove(child);
          disposeObject(child);
          continue;
        }
        existing.set(key, child);
      }
      for (const b of dirt) {
        const key = meshKey("dirt", b.id);
        if (existing.has(key)) continue;
        const mesh = buildDirtCoin(b);
        applySpinPose(mesh);
        root.add(mesh);
      }
      for (const c of rare) {
        const key = meshKey("special", c.id);
        if (existing.has(key)) continue;
        const mesh = buildSpecialCoin(c);
        applySpinPose(mesh);
        root.add(mesh);
      }
    },

    pick(camera, ndcX, ndcY): ShaftCoinPick | null {
      if (root.children.length === 0) return null;
      ndc.set(ndcX, ndcY);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(root.children, false);
      for (const hit of hits) {
        const kind = hit.object.userData.coinKind;
        const id = hit.object.userData.coinId;
        if (kind === "dirt" && typeof id === "string") {
          return { kind: "dirt", id };
        }
        if (kind === "special" && typeof id === "string") {
          return { kind: "special", id };
        }
      }
      return null;
    },

    update(dtSeconds): void {
      spin += dtSeconds * 1.6;
      if (root.children.length === 0) return;
      for (const child of root.children) {
        applySpinPose(child);
      }
    },

    dispose(): void {
      clear();
      disposeFaceTextures();
      parent.remove(root);
    },
  };
}
