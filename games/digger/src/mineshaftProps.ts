/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Rails + cobwebs + occasional minecarts for abandoned side mineshafts.
 */
import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Object3D,
} from "three";
import {
  mineshaftHasCobweb,
  mineshaftHasMinecart,
  mineshaftMinecartX,
  mineshaftsInDepthRange,
  MINESHAFT_HEIGHT,
  type MineshaftPlacement,
} from "./mineshafts.js";

export interface MineshaftProps {
  sync(excavatedDepth: number): void;
  dispose(): void;
}

/** How far above/below the dig face to keep décor loaded. */
const LOOK_AHEAD_M = 140;
const LOOK_BEHIND_M = 100;

const WEB_TEX_SIZE = 128;

const railMat = new MeshLambertMaterial({ color: 0x1a1a20 });
const tieMat = new MeshLambertMaterial({ color: 0x7a4e28 });
const cartBodyMat = new MeshLambertMaterial({ color: 0x6a6e78 });
const cartTrimMat = new MeshLambertMaterial({ color: 0x4a3a28 });
const cartWheelMat = new MeshLambertMaterial({ color: 0x1c1c22 });

/** Chunky so they read at dig-camera distance / narrow FOV. */
const railGeo = new BoxGeometry(1.02, 0.12, 0.12);
const tieGeo = new BoxGeometry(0.75, 0.12, 1.15);
const webPlaneGeo = new PlaneGeometry(1.05, 1.05);

/** Hollow crate cart: open top, plank sides, disk wheels. */
const cartFloorGeo = new BoxGeometry(0.72, 0.07, 0.52);
const cartSideGeo = new BoxGeometry(0.72, 0.32, 0.06);
const cartEndGeo = new BoxGeometry(0.06, 0.32, 0.52);
const cartWheelGeo = new CylinderGeometry(0.12, 0.12, 0.1, 12);

function makeCobwebTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = WEB_TEX_SIZE;
  canvas.height = WEB_TEX_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable for cobweb texture");

  const s = WEB_TEX_SIZE;
  ctx.clearRect(0, 0, s, s);

  // Corner-anchored web (reads as hanging from ceiling/wall join).
  const ox = s * 0.08;
  const oy = s * 0.08;
  const spokes = 7;
  const maxR = s * 0.92;

  ctx.strokeStyle = "rgba(235, 240, 248, 0.92)";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Radial strands from the corner.
  ctx.lineWidth = s * 0.018;
  for (let i = 0; i < spokes; i++) {
    const t = i / (spokes - 1);
    const a = (Math.PI / 2) * (0.08 + t * 0.84);
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(a) * maxR, oy + Math.sin(a) * maxR);
    ctx.stroke();
  }

  // Concentric arcs (slightly wobbly).
  ctx.lineWidth = s * 0.014;
  for (let ring = 1; ring <= 5; ring++) {
    const r = maxR * (0.16 + ring * 0.14);
    ctx.beginPath();
    for (let i = 0; i < spokes; i++) {
      const t = i / (spokes - 1);
      const a = (Math.PI / 2) * (0.08 + t * 0.84);
      const wobble = 1 + Math.sin(ring * 2.1 + i * 1.7) * 0.04;
      const x = ox + Math.cos(a) * r * wobble;
      const y = oy + Math.sin(a) * r * wobble;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // A few loose sticky threads.
  ctx.lineWidth = s * 0.011;
  ctx.strokeStyle = "rgba(220, 226, 236, 0.75)";
  const loose: Array<[number, number, number, number]> = [
    [0.22, 0.55, 0.48, 0.28],
    [0.55, 0.2, 0.78, 0.42],
    [0.35, 0.72, 0.62, 0.58],
  ];
  for (const [ax, ay, bx, by] of loose) {
    ctx.beginPath();
    ctx.moveTo(ox + ax * maxR, oy + ay * maxR);
    ctx.quadraticCurveTo(
      ox + ((ax + bx) / 2 + 0.08) * maxR,
      oy + ((ay + by) / 2 - 0.06) * maxR,
      ox + bx * maxR,
      oy + by * maxR,
    );
    ctx.stroke();
  }

  // Soft dust motes so it isn't pure line art.
  ctx.fillStyle = "rgba(245, 248, 255, 0.35)";
  for (const [px, py] of [
    [0.3, 0.25],
    [0.55, 0.4],
    [0.4, 0.6],
    [0.7, 0.55],
  ] as const) {
    ctx.beginPath();
    ctx.arc(ox + px * maxR, oy + py * maxR, s * 0.012, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new CanvasTexture(canvas);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

let webMat: MeshLambertMaterial | null = null;

function cobwebMaterial(): MeshLambertMaterial {
  if (!webMat) {
    webMat = new MeshLambertMaterial({
      map: makeCobwebTexture(),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: DoubleSide,
      alphaTest: 0.08,
    });
  }
  return webMat;
}

/** Meshes share module geometries/materials — only detach, do not dispose. */
function clearGroup(group: Group): void {
  while (group.children.length > 0) {
    group.remove(group.children[0]!);
  }
}

function addRailCell(parent: Group, x: number, floorY: number): void {
  const y = floorY + 0.08;
  // Sit in the front air cell so décor reads on the cutaway face.
  const zMid = 0.35;
  // Ties across Z every other block.
  if ((x & 1) === 0) {
    const tie = new Mesh(tieGeo, tieMat);
    tie.position.set(x + 0.5, y, zMid);
    tie.frustumCulled = false;
    tie.renderOrder = 2;
    parent.add(tie);
  }
  // Twin rails along X.
  for (const zOff of [-0.3, 0.3]) {
    const rail = new Mesh(railGeo, railMat);
    rail.position.set(x + 0.5, y + 0.05, zMid + zOff);
    rail.frustumCulled = false;
    rail.renderOrder = 2;
    parent.add(rail);
  }
}

function addCobweb(parent: Group, x: number, floorY: number): void {
  // Hang in the top air cell; crossed planes like a classic cobweb block.
  const ceilY = floorY + MINESHAFT_HEIGHT - 1 + 0.48;
  const zMid = 0.35;
  const spin = ((x * 17) & 3) * 0.15;
  for (const yaw of [Math.PI / 4 + spin, -Math.PI / 4 + spin]) {
    const plane = new Mesh(webPlaneGeo, cobwebMaterial());
    plane.position.set(x + 0.5, ceilY, zMid);
    plane.rotation.y = yaw;
    // Tip the web slightly so the corner anchor reads as ceiling-hung.
    plane.rotation.x = -0.15;
    plane.frustumCulled = false;
    plane.renderOrder = 3;
    parent.add(plane);
  }
}

function addMinecart(parent: Group, x: number, floorY: number): void {
  const cart = new Group();
  cart.name = "minecart";
  // Match rail mid-Z; body sits above rail tops (rails at floorY+0.13).
  const zMid = 0.35;
  cart.position.set(x + 0.5, floorY + 0.2, zMid);

  const floor = new Mesh(cartFloorGeo, cartTrimMat);
  floor.position.y = 0.1;
  floor.frustumCulled = false;
  floor.renderOrder = 4;
  cart.add(floor);

  // Open-top crate: long sides (along X) + short ends.
  for (const zOff of [-0.23, 0.23]) {
    const side = new Mesh(cartSideGeo, cartBodyMat);
    side.position.set(0, 0.28, zOff);
    side.frustumCulled = false;
    side.renderOrder = 4;
    cart.add(side);
  }
  for (const xOff of [-0.33, 0.33]) {
    const end = new Mesh(cartEndGeo, cartBodyMat);
    end.position.set(xOff, 0.28, 0);
    end.frustumCulled = false;
    end.renderOrder = 4;
    cart.add(end);
  }

  // Disk wheels: cylinder axis → Z so faces read along the rails.
  for (const xOff of [-0.22, 0.22]) {
    for (const zOff of [-0.28, 0.28]) {
      const wheel = new Mesh(cartWheelGeo, cartWheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(xOff, 0.02, zOff);
      wheel.frustumCulled = false;
      wheel.renderOrder = 4;
      cart.add(wheel);
    }
  }

  parent.add(cart);
}

function buildShaftDecor(m: MineshaftPlacement): Group {
  const g = new Group();
  g.name = `mineshaft-${m.id}`;
  const mouthX = m.side < 0 ? m.xMax : m.xMin;
  for (let x = m.xMin; x <= m.xMax; x++) {
    addRailCell(g, x, m.floorY);
    if (mineshaftHasCobweb(x, m.floorY, m.side, mouthX)) {
      addCobweb(g, x, m.floorY);
    }
  }
  if (mineshaftHasMinecart(m.band, m.side)) {
    const cx = mineshaftMinecartX(m.band, m.side, m.xMin, m.xMax);
    addMinecart(g, cx, m.floorY);
  }
  return g;
}

export function createMineshaftProps(parent: Object3D): MineshaftProps {
  const root = new Group();
  root.name = "mineshaft-props";
  parent.add(root);
  let lastKey = "";

  return {
    sync(excavatedDepth: number): void {
      const depth = Math.max(0, excavatedDepth);
      const lo = Math.max(0, depth - LOOK_BEHIND_M);
      const hi = depth + LOOK_AHEAD_M;
      const list = mineshaftsInDepthRange(lo, hi);
      const key = list.map((m) => m.id).join("|");
      if (key === lastKey) return;
      lastKey = key;
      clearGroup(root);
      for (const m of list) {
        root.add(buildShaftDecor(m));
      }
    },

    dispose(): void {
      clearGroup(root);
      parent.remove(root);
    },
  };
}
