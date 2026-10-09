/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Points,
  PointsMaterial,
  type Group,
} from "three";

const MAX_PARTICLES = 160;
const BURST_COUNT = 24;
const TRICKLE_COUNT = 3;
const PARTICLE_SIZE = 0.22;

/** Dirt / stone chip colors (sRGB hex). */
const CHIP_COLORS = [0x8b5a2b, 0x7a4e24, 0x6b4424, 0x9a7a55, 0x5a4a3a];

export type DigParticleStyle = "burst" | "trickle";

export interface DigParticles {
  /** Punchy tap-dig burst at the dig face (block-space floor Y = 1 − depth). */
  burst(excavatedDepth: number): void;
  /** Subtle passive-dig chips — fewer, slower, shorter-lived. */
  trickle(excavatedDepth: number): void;
  update(dtSeconds: number): void;
  dispose(): void;
}

/**
 * Tiny chip FX at the shaft dig face (lives in dig-world content space).
 */
export function createDigParticles(parent: Group): DigParticles {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  const velocities = new Float32Array(MAX_PARTICLES * 3);
  const ages = new Float32Array(MAX_PARTICLES);
  const lifetimes = new Float32Array(MAX_PARTICLES);
  let alive = 0;

  const geometry = new BufferGeometry();
  const posAttr = new BufferAttribute(positions, 3);
  const colAttr = new BufferAttribute(colors, 3);
  posAttr.setUsage(DynamicDrawUsage);
  colAttr.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", posAttr);
  geometry.setAttribute("color", colAttr);
  geometry.setDrawRange(0, 0);

  const material = new PointsMaterial({
    size: PARTICLE_SIZE,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });

  const points = new Points(geometry, material);
  points.name = "dig-particles";
  points.frustumCulled = false;
  parent.add(points);

  const spawnOne = (i: number, floorY: number, style: DigParticleStyle): void => {
    // Uniform over the 2×2 shaft floor (cells x,z ∈ [-1,0] → span [-1, 1]).
    positions[i * 3] = -1 + Math.random() * 2;
    positions[i * 3 + 1] = floorY + 0.02;
    positions[i * 3 + 2] = -1 + Math.random() * 2;

    if (style === "trickle") {
      // Soft loft — mostly vertical dust, little camera fan.
      velocities[i * 3] = (Math.random() - 0.5) * 0.55;
      velocities[i * 3 + 1] = 0.9 + Math.random() * 1.1;
      velocities[i * 3 + 2] = 0.1 + Math.random() * 0.45;
      ages[i] = 0;
      lifetimes[i] = 0.35 + Math.random() * 0.25;
    } else {
      velocities[i * 3] = (Math.random() - 0.5) * 1.8;
      velocities[i * 3 + 1] = 3.8 + Math.random() * 3.2;
      velocities[i * 3 + 2] = 0.4 + Math.random() * 1.6;
      ages[i] = 0;
      lifetimes[i] = 0.55 + Math.random() * 0.4;
    }

    const hex = CHIP_COLORS[Math.floor(Math.random() * CHIP_COLORS.length)]!;
    // Trickle chips a touch darker / dustier.
    const dim = style === "trickle" ? 0.82 : 1;
    colors[i * 3] = (((hex >> 16) & 255) / 255) * dim;
    colors[i * 3 + 1] = (((hex >> 8) & 255) / 255) * dim;
    colors[i * 3 + 2] = ((hex & 255) / 255) * dim;
  };

  const emit = (excavatedDepth: number, style: DigParticleStyle, count: number): void => {
    const floorY = 1 - Math.max(0, excavatedDepth);
    const toSpawn = Math.min(count, MAX_PARTICLES);
    for (let n = 0; n < toSpawn; n++) {
      const i = alive < MAX_PARTICLES ? alive++ : n % MAX_PARTICLES;
      spawnOne(i, floorY, style);
    }
    geometry.setDrawRange(0, alive);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  };

  return {
    burst(excavatedDepth: number): void {
      emit(excavatedDepth, "burst", BURST_COUNT);
    },

    trickle(excavatedDepth: number): void {
      emit(excavatedDepth, "trickle", TRICKLE_COUNT);
    },

    update(dtSeconds: number): void {
      if (alive === 0 || dtSeconds <= 0) return;
      const gravity = -11;
      let write = 0;
      for (let i = 0; i < alive; i++) {
        ages[i]! += dtSeconds;
        if (ages[i]! >= lifetimes[i]!) continue;

        // Trickle particles use the same integrator; lower spawn vel keeps them soft.
        velocities[i * 3 + 1]! += gravity * dtSeconds;
        positions[i * 3]! += velocities[i * 3]! * dtSeconds;
        positions[i * 3 + 1]! += velocities[i * 3 + 1]! * dtSeconds;
        positions[i * 3 + 2]! += velocities[i * 3 + 2]! * dtSeconds;

        if (write !== i) {
          positions[write * 3] = positions[i * 3]!;
          positions[write * 3 + 1] = positions[i * 3 + 1]!;
          positions[write * 3 + 2] = positions[i * 3 + 2]!;
          velocities[write * 3] = velocities[i * 3]!;
          velocities[write * 3 + 1] = velocities[i * 3 + 1]!;
          velocities[write * 3 + 2] = velocities[i * 3 + 2]!;
          colors[write * 3] = colors[i * 3]!;
          colors[write * 3 + 1] = colors[i * 3 + 1]!;
          colors[write * 3 + 2] = colors[i * 3 + 2]!;
          ages[write] = ages[i]!;
          lifetimes[write] = lifetimes[i]!;
        }
        write += 1;
      }
      alive = write;
      geometry.setDrawRange(0, alive);
      posAttr.needsUpdate = true;
      if (alive > 0) colAttr.needsUpdate = true;
    },

    dispose(): void {
      parent.remove(points);
      geometry.dispose();
      material.dispose();
      alive = 0;
    },
  };
}
