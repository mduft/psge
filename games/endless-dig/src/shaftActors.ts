/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 *
 * Procedural digger + upgrade-driven crew/machinery in the shaft (M6).
 */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  type Object3D,
} from "three";
import { digToolOf, type DigTool } from "./digCursor.js";
import type { UpgradeLevels } from "./upgrades.js";

export interface ShaftActors {
  /** Place actors at dig face; refresh props from upgrades. */
  sync(excavatedDepth: number, upgrades: UpgradeLevels): void;
  /** Idle bob + swing countdown. */
  update(dtSeconds: number): void;
  /** Trigger digger swing (tap dig). */
  playDigSwing(): void;
  /** Subtle crew pick pulse (passive trickle). */
  playCrewChip(): void;
  dispose(): void;
}

const MAX_CREW = 8;

/** Local XZ slots inside the 2×2 shaft (relative to digger root). */
const CREW_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [-0.55, -0.35],
  [-0.35, -0.75],
  [0.2, -0.95],
  [-0.55, 0.05],
  [0.15, -0.55],
  [-0.15, -1.05],
  [0.25, -0.2],
  [-0.25, -0.45],
];

function mat(hex: number): MeshLambertMaterial {
  return new MeshLambertMaterial({ color: hex });
}

function box(
  parent: Object3D,
  material: MeshLambertMaterial,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function makeDigger(): { root: Group; arm: Group; toolSlot: Group } {
  const root = new Group();
  root.name = "digger";
  const skin = mat(0xc4a574);
  const cloth = mat(0x3a5a7a);
  const boot = mat(0x2a2018);
  box(root, boot, 0.22, 0.12, 0.28, -0.1, 0.06, 0);
  box(root, boot, 0.22, 0.12, 0.28, 0.1, 0.06, 0);
  box(root, cloth, 0.36, 0.42, 0.22, 0, 0.36, 0);
  box(root, skin, 0.28, 0.28, 0.28, 0, 0.68, 0);
  // Idle left arm — hangs still at the digger's side.
  const leftArm = new Group();
  leftArm.position.set(-0.22, 0.48, 0);
  leftArm.rotation.x = 0.15;
  root.add(leftArm);
  box(leftArm, skin, 0.14, 0.36, 0.14, 0, -0.1, 0);
  // Right arm swings with dig.
  const arm = new Group();
  arm.position.set(0.22, 0.48, 0);
  root.add(arm);
  box(arm, skin, 0.14, 0.36, 0.14, 0, -0.1, 0);
  const toolSlot = new Group();
  toolSlot.position.set(0, -0.28, 0.08);
  arm.add(toolSlot);
  return { root, arm, toolSlot };
}

function makeTool(tool: DigTool): Group {
  const g = new Group();
  const wood = mat(0x6b4f2a);
  const steel = mat(0x9aa0a8);
  if (tool === "spoon") {
    box(g, wood, 0.06, 0.35, 0.06, 0, 0.1, 0);
    box(g, steel, 0.14, 0.08, 0.1, 0, -0.08, 0.02);
  } else if (tool === "shovel") {
    box(g, wood, 0.07, 0.45, 0.07, 0, 0.12, 0);
    box(g, steel, 0.22, 0.16, 0.04, 0, -0.12, 0.04);
  } else if (tool === "pickaxe") {
    box(g, wood, 0.07, 0.42, 0.07, 0, 0.1, 0);
    box(g, steel, 0.36, 0.08, 0.08, 0, -0.12, 0);
  } else {
    box(g, steel, 0.12, 0.5, 0.12, 0, 0.05, 0);
    box(g, mat(0x445566), 0.2, 0.14, 0.2, 0, 0.28, 0);
  }
  return g;
}

function makeWorker(): Group {
  const root = new Group();
  const skin = mat(0xb8956a);
  const cloth = mat(0x5a6a4a);
  box(root, cloth, 0.22, 0.28, 0.16, 0, 0.28, 0);
  box(root, skin, 0.18, 0.18, 0.18, 0, 0.5, 0);
  return root;
}

function makeCart(): Group {
  const root = new Group();
  const wood = mat(0x6b4424);
  const iron = mat(0x4a4a50);
  box(root, wood, 0.7, 0.35, 0.45, 0, 0.28, 0);
  box(root, iron, 0.12, 0.12, 0.08, -0.28, 0.08, 0.22);
  box(root, iron, 0.12, 0.12, 0.08, 0.28, 0.08, 0.22);
  box(root, iron, 0.12, 0.12, 0.08, -0.28, 0.08, -0.22);
  box(root, iron, 0.12, 0.12, 0.08, 0.28, 0.08, -0.22);
  return root;
}

function makeDrill(): Group {
  // Compact gantry meant to sit on the back wall (−Z), bit facing the dig face.
  const root = new Group();
  const frame = mat(0x5a6068);
  const bit = mat(0x9aa0a8);
  box(root, frame, 0.55, 0.12, 0.12, 0, 1.05, 0);
  box(root, frame, 0.12, 0.55, 0.12, -0.22, 0.75, 0);
  box(root, frame, 0.12, 0.55, 0.12, 0.22, 0.75, 0);
  const cyl = new Mesh(new CylinderGeometry(0.06, 0.03, 0.55, 6), bit);
  cyl.position.set(0, 0.45, 0.12);
  root.add(cyl);
  return root;
}

/**
 * Blocky miner + optional cart / drill / crew at the dig face.
 */
export function createShaftActors(parent: Group): ShaftActors {
  const root = new Group();
  root.name = "shaft-actors";
  parent.add(root);

  const digger = makeDigger();
  root.add(digger.root);

  const props = new Group();
  props.name = "shaft-props";
  root.add(props);

  let swingT = 0;
  let crewPulse = 0;
  let currentTool: DigTool | null = null;
  let cartLevel = -1;
  let drillLevel = -1;
  let crewLevel = -1;
  const workers: Group[] = [];

  const setTool = (tool: DigTool): void => {
    if (tool === currentTool) return;
    currentTool = tool;
    while (digger.toolSlot.children.length) {
      const c = digger.toolSlot.children[0]!;
      digger.toolSlot.remove(c);
      c.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          (o.material as MeshLambertMaterial).dispose();
        }
      });
    }
    digger.toolSlot.add(makeTool(tool));
  };

  const rebuildProps = (upgrades: UpgradeLevels): void => {
    const needCart = upgrades.cart;
    const needDrill = upgrades.drill;
    const needCrew = upgrades.crew;
    if (
      needCart === cartLevel &&
      needDrill === drillLevel &&
      needCrew === crewLevel
    ) {
      return;
    }
    cartLevel = needCart;
    drillLevel = needDrill;
    crewLevel = needCrew;

    while (props.children.length) {
      const c = props.children[0]!;
      props.remove(c);
      c.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          (o.material as MeshLambertMaterial).dispose();
        }
      });
    }
    workers.length = 0;

    if (needCart > 0) {
      const cart = makeCart();
      const scale = 0.7 + Math.min(0.25, needCart * 0.03);
      cart.scale.setScalar(scale);
      // Right side of the 2×2 shaft — visible, clear of the crew, not in the wall.
      cart.position.set(0.55, 0, -0.35);
      cart.rotation.y = -0.25;
      props.add(cart);
    }
    if (needDrill > 0) {
      const drill = makeDrill();
      drill.scale.setScalar(0.7 + Math.min(0.25, needDrill * 0.03));
      // Back wall of the shaft (−Z), bit toward the floor / dig face.
      drill.position.set(0.05, 0, -0.95);
      drill.rotation.y = Math.PI;
      props.add(drill);
    }
    const n = Math.min(MAX_CREW, needCrew, CREW_SLOTS.length);
    for (let i = 0; i < n; i++) {
      const w = makeWorker();
      const [sx, sz] = CREW_SLOTS[i]!;
      w.position.set(sx, 0, sz);
      w.scale.setScalar(0.8);
      props.add(w);
      workers.push(w);
    }
  };

  return {
    sync(excavatedDepth: number, upgrades: UpgradeLevels): void {
      const floorY = 1 - Math.max(0, excavatedDepth);
      root.position.set(-0.15, floorY, 0.55);
      setTool(digToolOf(upgrades));
      rebuildProps(upgrades);
    },

    update(dtSeconds: number): void {
      const t = performance.now() * 0.001;
      digger.root.position.y = Math.sin(t * 2.2) * 0.02;
      if (swingT > 0) {
        swingT = Math.max(0, swingT - dtSeconds);
        const u = 1 - swingT / 0.28;
        digger.arm.rotation.x = -Math.sin(u * Math.PI) * 1.1;
      } else {
        digger.arm.rotation.x = Math.sin(t * 1.6) * 0.08;
      }
      if (crewPulse > 0) {
        crewPulse = Math.max(0, crewPulse - dtSeconds);
      }
      for (let i = 0; i < workers.length; i++) {
        const w = workers[i]!;
        const bob = Math.sin(t * 2.4 + i) * 0.025;
        const punch =
          crewPulse > 0 ? Math.sin((1 - crewPulse / 0.2) * Math.PI) * 0.06 : 0;
        w.position.y = bob + punch;
      }
    },

    playDigSwing(): void {
      swingT = 0.28;
    },

    playCrewChip(): void {
      crewPulse = 0.2;
    },

    dispose(): void {
      parent.remove(root);
      root.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          (o.material as MeshLambertMaterial).dispose();
        }
      });
    },
  };
}
