import {
  CanvasTexture,
  Color,
  MeshLambertMaterial,
  NearestFilter,
  SRGBColorSpace,
  type Material,
} from "three";

export type BlockId =
  | "grass"
  | "dirt"
  | "stone"
  | "granite"
  | "deepslate"
  | "log"
  | "leaves"
  | "cobble";

interface BlockPalette {
  top: string;
  side: string;
  bottom: string;
  noise: number;
}

const PALETTES: Record<BlockId, BlockPalette> = {
  grass: { top: "#5d9b3a", side: "#8b5a2b", bottom: "#6b4424", noise: 28 },
  dirt: { top: "#8b5a2b", side: "#7a4e24", bottom: "#6b4424", noise: 22 },
  stone: { top: "#8a8a8a", side: "#7a7a7a", bottom: "#6a6a6a", noise: 30 },
  granite: { top: "#9a6b5a", side: "#8a5b4a", bottom: "#7a4b3a", noise: 26 },
  deepslate: { top: "#3d4450", side: "#323842", bottom: "#282e36", noise: 20 },
  log: { top: "#6b4f2a", side: "#5a3f22", bottom: "#4a3218", noise: 18 },
  leaves: { top: "#3f8f3a", side: "#347a30", bottom: "#2a6628", noise: 35 },
  cobble: { top: "#7d7d7d", side: "#6e6e6e", bottom: "#5f5f5f", noise: 40 },
};

function paintFace(
  ctx: CanvasRenderingContext2D,
  hex: string,
  noise: number,
  size: number,
): void {
  const base = new Color(hex);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < noise; i++) {
    const x = (Math.random() * size) | 0;
    const y = (Math.random() * size) | 0;
    const c = base.clone();
    const d = (Math.random() - 0.5) * 0.22;
    c.offsetHSL(0, 0, d);
    ctx.fillStyle = `#${c.getHexString()}`;
    ctx.fillRect(x, y, 1 + ((Math.random() * 2) | 0), 1);
  }

  // Subtle edge darkening (reads as block bevel without AO pass).
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
}

function makeFaceTexture(hex: string, noise: number): CanvasTexture {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas unavailable");
  }
  paintFace(ctx, hex, noise, size);
  const tex = new CanvasTexture(canvas);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Minecraft-style materials: [right, left, top, bottom, front, back] */
export function createBlockMaterials(id: BlockId): Material[] {
  const p = PALETTES[id];
  const top = makeFaceTexture(p.top, p.noise);
  const side = makeFaceTexture(p.side, p.noise);
  const bottom = makeFaceTexture(p.bottom, Math.max(8, p.noise - 6));

  const mk = (map: CanvasTexture) =>
    new MeshLambertMaterial({ map });

  return [mk(side), mk(side), mk(top), mk(bottom), mk(side), mk(side)];
}

export function createSkyColor(): Color {
  return new Color(0x87b7e0);
}
