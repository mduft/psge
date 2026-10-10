/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Rails + cobwebs + occasional minecarts / crates / torches for side shafts.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  Raycaster,
  SRGBColorSpace,
  SphereGeometry,
  Vector2,
  type Camera,
  type Object3D,
} from "three";
import {
  mineshaftCrateIsBarrel,
  mineshaftCrateX,
  mineshaftDecorStyle,
  mineshaftHasCobweb,
  mineshaftHasCrate,
  mineshaftHasMinecart,
  mineshaftHasTorch,
  mineshaftMinecartX,
  mineshaftsInDepthRange,
  MINESHAFT_HEIGHT,
  type MineshaftPlacement,
} from "./mineshafts.js";

export interface MineshaftCartPick {
  id: string;
}

export interface MineshaftSyncResult {
  /** Shaft ids that just entered the near dig-face band. */
  newShaftIds: string[];
  /** Cart ids that just entered the near dig-face band. */
  newCartIds: string[];
  /** Play rail SFX — near-band cart appear after the first sync. */
  cartAppeared: boolean;
}

export interface MineshaftProps {
  sync(
    excavatedDepth: number,
    claimedCartIds?: ReadonlySet<string>,
  ): MineshaftSyncResult;
  pickCart(camera: Camera, ndcX: number, ndcY: number): MineshaftCartPick | null;
  setCartHover(pick: MineshaftCartPick | null): void;
  /** Dim a claimed cart so it reads as looted. */
  markCartClaimed(id: string): void;
  /** Flicker torch glows (call each frame). */
  update(dtSeconds: number): void;
  dispose(): void;
}

/** How far above/below the dig face to keep décor loaded. */
const LOOK_AHEAD_M = 140;
const LOOK_BEHIND_M = 100;
/** ~6 blocks from dig face for “scrolled into view” SFX / spot achievements. */
const NEAR_AHEAD_M = 6;
const NEAR_BEHIND_M = 6;
const WEB_TEX_SIZE = 128;
const HOVER_SCALE = 1.12;

const railMatWood = new MeshLambertMaterial({ color: 0x1a1a20 });
const railMatIron = new MeshLambertMaterial({ color: 0x2a3038 });
const tieMatWood = new MeshLambertMaterial({ color: 0x7a4e28 });
const tieMatIron = new MeshLambertMaterial({ color: 0x4a5058 });
const cartBodyMat = new MeshLambertMaterial({ color: 0x6a6e78 });
const cartTrimMat = new MeshLambertMaterial({ color: 0x4a3a28 });
const cartWheelMat = new MeshLambertMaterial({ color: 0x1c1c22 });
const cartFillDirt = new MeshLambertMaterial({ color: 0x6b5340 });
const cartFillCoal = new MeshLambertMaterial({ color: 0x2a2a30 });
const crateMat = new MeshLambertMaterial({ color: 0x8a6238 });
const barrelMat = new MeshLambertMaterial({ color: 0x5a3f22 });
const barrelBandMat = new MeshLambertMaterial({ color: 0x3a3a42 });
const torchPoleMat = new MeshLambertMaterial({ color: 0x5a3f22 });

const railGeo = new BoxGeometry(1.02, 0.12, 0.12);
const tieGeo = new BoxGeometry(0.75, 0.12, 1.15);
const webPlaneGeo = new PlaneGeometry(1.05, 1.05);
const cartFloorGeo = new BoxGeometry(0.72, 0.07, 0.52);
const cartSideGeo = new BoxGeometry(0.72, 0.32, 0.06);
const cartEndGeo = new BoxGeometry(0.06, 0.32, 0.52);
const cartWheelGeo = new CylinderGeometry(0.12, 0.12, 0.1, 12);
const fillLumpGeo = new SphereGeometry(0.12, 6, 5);
const crateGeo = new BoxGeometry(0.42, 0.38, 0.42);
const barrelGeo = new CylinderGeometry(0.2, 0.22, 0.4, 10);
const barrelBandGeo = new CylinderGeometry(0.225, 0.225, 0.04, 10);
const torchPoleGeo = new BoxGeometry(0.06, 0.45, 0.06);
const torchGlowGeo = new PlaneGeometry(1, 1);
const cartHitGeo = new BoxGeometry(0.85, 0.55, 0.7);

const TORCH_GLOW_TEX_SIZE = 64;

function makeTorchGlowTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TORCH_GLOW_TEX_SIZE;
  canvas.height = TORCH_GLOW_TEX_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable for torch glow");
  const c = TORCH_GLOW_TEX_SIZE / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, "rgba(255, 245, 200, 1)");
  g.addColorStop(0.18, "rgba(255, 190, 80, 0.95)");
  g.addColorStop(0.42, "rgba(255, 120, 40, 0.55)");
  g.addColorStop(0.7, "rgba(255, 70, 20, 0.18)");
  g.addColorStop(1, "rgba(255, 40, 0, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TORCH_GLOW_TEX_SIZE, TORCH_GLOW_TEX_SIZE);
  const tex = new CanvasTexture(canvas);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

let torchGlowMat: MeshBasicMaterial | null = null;
let torchCoreMat: MeshBasicMaterial | null = null;

function torchGlowMaterial(): MeshBasicMaterial {
  if (!torchGlowMat) {
    torchGlowMat = new MeshBasicMaterial({
      map: makeTorchGlowTexture(),
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
  }
  return torchGlowMat;
}

function torchCoreMaterial(): MeshBasicMaterial {
  if (!torchCoreMat) {
    torchCoreMat = new MeshBasicMaterial({
      map: makeTorchGlowTexture(),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: DoubleSide,
    });
  }
  return torchCoreMat;
}

function makeCobwebTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = WEB_TEX_SIZE;
  canvas.height = WEB_TEX_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable for cobweb texture");

  const s = WEB_TEX_SIZE;
  ctx.clearRect(0, 0, s, s);
  const ox = s * 0.08;
  const oy = s * 0.08;
  const spokes = 7;
  const maxR = s * 0.92;

  ctx.strokeStyle = "rgba(235, 240, 248, 0.92)";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = s * 0.018;
  for (let i = 0; i < spokes; i++) {
    const t = i / (spokes - 1);
    const a = (Math.PI / 2) * (0.08 + t * 0.84);
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(a) * maxR, oy + Math.sin(a) * maxR);
    ctx.stroke();
  }
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
  ctx.lineWidth = s * 0.011;
  ctx.strokeStyle = "rgba(220, 226, 236, 0.75)";
  for (const [ax, ay, bx, by] of [
    [0.22, 0.55, 0.48, 0.28],
    [0.55, 0.2, 0.78, 0.42],
    [0.35, 0.72, 0.62, 0.58],
  ] as const) {
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

function clearGroup(group: Group): void {
  while (group.children.length > 0) {
    group.remove(group.children[0]!);
  }
}

function addRailCell(
  parent: Group,
  x: number,
  floorY: number,
  iron: boolean,
): void {
  const y = floorY + 0.08;
  const zMid = 0.35;
  const tieM = iron ? tieMatIron : tieMatWood;
  const railM = iron ? railMatIron : railMatWood;
  if ((x & 1) === 0) {
    const tie = new Mesh(tieGeo, tieM);
    tie.position.set(x + 0.5, y, zMid);
    tie.frustumCulled = false;
    tie.renderOrder = 2;
    parent.add(tie);
  }
  for (const zOff of [-0.3, 0.3]) {
    const rail = new Mesh(railGeo, railM);
    rail.position.set(x + 0.5, y + 0.05, zMid + zOff);
    rail.frustumCulled = false;
    rail.renderOrder = 2;
    parent.add(rail);
  }
}

function addCobweb(parent: Group, x: number, floorY: number): void {
  const ceilY = floorY + MINESHAFT_HEIGHT - 1 + 0.48;
  const zMid = 0.35;
  const spin = ((x * 17) & 3) * 0.15;
  for (const yaw of [Math.PI / 4 + spin, -Math.PI / 4 + spin]) {
    const plane = new Mesh(webPlaneGeo, cobwebMaterial());
    plane.position.set(x + 0.5, ceilY, zMid);
    plane.rotation.y = yaw;
    plane.rotation.x = -0.15;
    plane.frustumCulled = false;
    plane.renderOrder = 3;
    parent.add(plane);
  }
}

function addTorch(parent: Group, x: number, floorY: number): Group {
  const g = new Group();
  g.name = "mineshaft-torch";
  g.userData.isTorch = true;
  // Deterministic per-cell phase so neighbors don't sync.
  const seed = Math.imul(x | 0, 374761393) + Math.imul(floorY | 0, 668265263);
  const u = ((seed ^ (seed >>> 13)) >>> 0) / 4294967296;
  const v = (((seed * 1274126177) ^ (seed >>> 16)) >>> 0) / 4294967296;
  g.userData.torchPhase = u * Math.PI * 2;
  g.userData.torchPhase2 = v * Math.PI * 2;
  g.userData.torchSpeed = 7 + u * 5;
  g.userData.torchSpeed2 = 11 + v * 7;
  g.position.set(x + 0.5, floorY + MINESHAFT_HEIGHT - 1.15, -0.85);

  const pole = new Mesh(torchPoleGeo, torchPoleMat);
  pole.position.y = 0.1;
  pole.frustumCulled = false;
  g.add(pole);

  // Soft radial glow: large additive halo + smaller normal-blend core.
  const glowY = 0.4;
  for (const [yaw, scale, mat, order] of [
    [0, 1.55, torchGlowMaterial(), 5],
    [Math.PI / 2, 1.55, torchGlowMaterial(), 5],
    [Math.PI / 4, 0.55, torchCoreMaterial(), 6],
    [-Math.PI / 4, 0.55, torchCoreMaterial(), 6],
  ] as const) {
    const plane = new Mesh(torchGlowGeo, mat);
    plane.position.set(0, glowY, 0.05);
    plane.userData.torchBaseY = glowY;
    plane.userData.torchBaseScale = scale;
    plane.userData.isTorchGlow = true;
    plane.rotation.y = yaw;
    plane.scale.setScalar(scale);
    plane.frustumCulled = false;
    plane.renderOrder = order;
    g.add(plane);
  }
  parent.add(g);
  return g;
}

function addCrateOrBarrel(
  parent: Group,
  x: number,
  floorY: number,
  barrel: boolean,
): void {
  const zMid = 0.35;
  if (barrel) {
    const body = new Mesh(barrelGeo, barrelMat);
    body.position.set(x + 0.5, floorY + 0.32, zMid);
    body.frustumCulled = false;
    body.renderOrder = 4;
    parent.add(body);
    for (const yOff of [0.08, 0.28]) {
      const band = new Mesh(barrelBandGeo, barrelBandMat);
      band.position.set(x + 0.5, floorY + 0.18 + yOff, zMid);
      band.frustumCulled = false;
      band.renderOrder = 4;
      parent.add(band);
    }
  } else {
    const crate = new Mesh(crateGeo, crateMat);
    crate.position.set(x + 0.5, floorY + 0.3, zMid);
    crate.frustumCulled = false;
    crate.renderOrder = 4;
    parent.add(crate);
  }
}

function addCartFill(cart: Group, depthM: number): void {
  const fillMat = depthM >= 4_000 ? cartFillCoal : cartFillDirt;
  // Mound above the rim (~0.44) so the dig camera sees the load over the walls.
  const lumps: Array<[number, number, number, number]> = [
    [0, 0.48, 0.02, 1.45],
    [-0.12, 0.44, 0, 1.15],
    [0.14, 0.45, 0.04, 1.1],
    [0.02, 0.52, 0.06, 0.95],
    [-0.08, 0.42, -0.04, 0.85],
  ];
  for (const [lx, ly, lz, s] of lumps) {
    const lump = new Mesh(fillLumpGeo, fillMat);
    lump.position.set(lx, ly, lz);
    lump.scale.setScalar(s);
    lump.frustumCulled = false;
    lump.renderOrder = 5;
    cart.add(lump);
  }
}

function addMinecart(
  parent: Group,
  x: number,
  floorY: number,
  id: string,
  claimed: boolean,
): void {
  const cart = new Group();
  cart.name = "minecart";
  cart.userData.minecartId = id;
  cart.userData.claimed = claimed;
  const zMid = 0.35;
  cart.position.set(x + 0.5, floorY + 0.2, zMid);

  const floor = new Mesh(cartFloorGeo, cartTrimMat);
  floor.position.y = 0.1;
  floor.frustumCulled = false;
  floor.renderOrder = 4;
  cart.add(floor);

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

  if (!claimed) addCartFill(cart, -floorY);

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

  const hit = new Mesh(
    cartHitGeo,
    new MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  hit.position.y = 0.28;
  hit.userData.isHitProxy = true;
  hit.frustumCulled = false;
  cart.add(hit);

  if (claimed) cart.scale.setScalar(0.92);
  parent.add(cart);
}

function buildShaftDecor(
  m: MineshaftPlacement,
  claimedCartIds: ReadonlySet<string>,
  torchesOut: Group[],
): Group {
  const g = new Group();
  g.name = `mineshaft-${m.id}`;
  g.userData.mineshaftId = m.id;
  const mouthX = m.side < 0 ? m.xMax : m.xMin;
  const iron = mineshaftDecorStyle(m.depthM) === "iron";
  for (let x = m.xMin; x <= m.xMax; x++) {
    addRailCell(g, x, m.floorY, iron);
    if (mineshaftHasCobweb(x, m.floorY, m.side, mouthX)) {
      addCobweb(g, x, m.floorY);
    }
    if (mineshaftHasTorch(x, m.floorY, m.side, mouthX)) {
      torchesOut.push(addTorch(g, x, m.floorY));
    }
  }
  if (mineshaftHasCrate(m.band, m.side)) {
    const cx = mineshaftCrateX(m.band, m.side, m.xMin, m.xMax);
    addCrateOrBarrel(
      g,
      cx,
      m.floorY,
      mineshaftCrateIsBarrel(m.band, m.side),
    );
  }
  if (mineshaftHasMinecart(m.band, m.side)) {
    const cx = mineshaftMinecartX(m.band, m.side, m.xMin, m.xMax);
    addMinecart(g, cx, m.floorY, m.id, claimedCartIds.has(m.id));
  }
  return g;
}

function pickFromObject(obj: Object3D): MineshaftCartPick | null {
  let o: Object3D | null = obj;
  while (o) {
    const id = o.userData.minecartId;
    if (typeof id === "string" && o.userData.claimed !== true) {
      return { id };
    }
    o = o.parent;
  }
  return null;
}

function setCartGroupHover(g: Group, hovered: boolean): void {
  g.scale.setScalar(
    g.userData.claimed === true ? 0.92 : hovered ? HOVER_SCALE : 1,
  );
}

export function createMineshaftProps(parent: Object3D): MineshaftProps {
  const root = new Group();
  root.name = "mineshaft-props";
  parent.add(root);
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  let lastKey = "";
  let prevNearShaftIds = new Set<string>();
  let prevNearCartIds = new Set<string>();
  let syncedOnce = false;
  let hoverId: string | null = null;
  let torchTime = 0;
  let torches: Group[] = [];

  const findCart = (id: string): Group | null => {
    let found: Group | null = null;
    root.traverse((o) => {
      if (found) return;
      if (o instanceof Group && o.userData.minecartId === id) found = o;
    });
    return found;
  };

  return {
    sync(excavatedDepth, claimedCartIds = new Set()): MineshaftSyncResult {
      const depth = Math.max(0, excavatedDepth);
      const lo = Math.max(0, depth - LOOK_BEHIND_M);
      const hi = depth + LOOK_AHEAD_M;
      const list = mineshaftsInDepthRange(lo, hi);
      const key =
        list.map((m) => m.id).join("|") +
        "#" +
        [...claimedCartIds].sort().join(",");
      // Spot / SFX when the shaft is beside the dig face — not when it
      // merely enters the wide load window (~140 m ahead).
      const nearLo = depth - NEAR_BEHIND_M;
      const nearHi = depth + NEAR_AHEAD_M;
      const near = list.filter(
        (m) => m.depthM >= nearLo && m.depthM <= nearHi,
      );
      const nearShaftIds = new Set(near.map((m) => m.id));
      const nearCartIds = new Set(
        near
          .filter((m) => mineshaftHasMinecart(m.band, m.side))
          .map((m) => m.id),
      );
      const newShaftIds = [...nearShaftIds].filter(
        (id) => !prevNearShaftIds.has(id),
      );
      const newCartIds = [...nearCartIds].filter(
        (id) => !prevNearCartIds.has(id),
      );
      const cartAppeared = syncedOnce && newCartIds.length > 0;
      prevNearShaftIds = nearShaftIds;
      prevNearCartIds = nearCartIds;
      syncedOnce = true;

      if (key !== lastKey) {
        lastKey = key;
        clearGroup(root);
        hoverId = null;
        torches = [];
        for (const m of list) {
          root.add(buildShaftDecor(m, claimedCartIds, torches));
        }
      }
      return { newShaftIds, newCartIds, cartAppeared };
    },

    pickCart(camera, ndcX, ndcY): MineshaftCartPick | null {
      ndc.set(ndcX, ndcY);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(root.children, true);
      for (const h of hits) {
        const pick = pickFromObject(h.object);
        if (pick) return pick;
      }
      return null;
    },

    setCartHover(pick): void {
      const next = pick?.id ?? null;
      if (next === hoverId) return;
      if (hoverId) {
        const prev = findCart(hoverId);
        if (prev) setCartGroupHover(prev, false);
      }
      hoverId = next;
      if (next) {
        const g = findCart(next);
        if (g) setCartGroupHover(g, true);
      }
    },

    markCartClaimed(id): void {
      const g = findCart(id);
      if (!g) return;
      g.userData.claimed = true;
      // Drop fill lumps (spheres that aren't hit proxies).
      for (const child of [...g.children]) {
        if (
          child instanceof Mesh &&
          child.geometry instanceof SphereGeometry &&
          !child.userData.isHitProxy
        ) {
          g.remove(child);
        }
      }
      setCartGroupHover(g, false);
      if (hoverId === id) hoverId = null;
    },

    update(dtSeconds: number): void {
      if (torches.length === 0) return;
      const dt =
        Number.isFinite(dtSeconds) && dtSeconds > 0
          ? Math.min(0.05, dtSeconds)
          : 0;
      torchTime += dt;
      for (const torch of torches) {
        const phase = Number(torch.userData.torchPhase) || 0;
        const phase2 = Number(torch.userData.torchPhase2) || 0;
        const speed = Number(torch.userData.torchSpeed) || 8;
        const speed2 = Number(torch.userData.torchSpeed2) || 12;
        const t = torchTime;
        // Two incommensurate waves → irregular flicker, unique per torch.
        const flicker =
          0.94 +
          0.045 * Math.sin(t * speed + phase) +
          0.03 * Math.sin(t * speed2 + phase2) +
          0.015 * Math.sin(t * (speed * 1.7) + phase * 1.3);
        const swayX = 0.01 * Math.sin(t * (speed * 0.55) + phase2);
        const swayY = 0.008 * Math.sin(t * (speed2 * 0.4) + phase);
        for (const child of torch.children) {
          if (!(child instanceof Mesh) || !child.userData.isTorchGlow) continue;
          const base = Number(child.userData.torchBaseScale) || 1;
          const baseY = Number(child.userData.torchBaseY) || 0.4;
          child.scale.setScalar(base * flicker);
          child.position.x = swayX;
          child.position.y = baseY + swayY;
        }
      }
    },

    dispose(): void {
      torches = [];
      clearGroup(root);
      parent.remove(root);
    },
  };
}
