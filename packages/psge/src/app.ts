/**
 * Copyright (c) 2026 Markus Duft
 * SPDX-License-Identifier: MIT
 */
import {
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Group,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clampDelta } from "./time.js";

export type Vec3 = readonly [number, number, number];

export interface CameraBootstrapOptions {
  fov?: number;
  near?: number;
  far?: number;
  position?: Vec3;
  lookAt?: Vec3;
  up?: Vec3;
}

export interface LightingOptions {
  /** Soft sky/ground hemisphere. */
  hemisphere?: { sky?: number; ground?: number; intensity?: number };
  ambient?: { color?: number; intensity?: number };
  /** Key + optional fill directional lights. */
  directional?: Array<{
    color?: number;
    intensity?: number;
    position: Vec3;
  }>;
}

export interface CreateAppOptions {
  canvas: HTMLCanvasElement;
  /** CSS or hex background color. Default transparent black (0x000000). */
  background?: string | number;
  antialias?: boolean;
  /** When false/undefined, no lights are added — the game owns lighting. */
  lighting?: false | LightingOptions;
  camera?: CameraBootstrapOptions;
}

export interface SetCameraOptions {
  position: Vec3;
  lookAt: Vec3;
  up?: Vec3;
}

export interface PsgeApp {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  startLoop(update?: (deltaSeconds: number) => void): void;
  stopLoop(): void;
  loadGltf(url: string): Promise<Group>;
  setCamera(options: SetCameraOptions): void;
  dispose(): void;
}

function applyLighting(scene: Scene, lighting: LightingOptions): void {
  if (lighting.hemisphere) {
    const h = lighting.hemisphere;
    scene.add(
      new HemisphereLight(h.sky ?? 0xffffff, h.ground ?? 0x444444, h.intensity ?? 0.8),
    );
  }
  if (lighting.ambient) {
    const a = lighting.ambient;
    scene.add(new AmbientLight(a.color ?? 0xffffff, a.intensity ?? 0.4));
  }
  for (const d of lighting.directional ?? []) {
    const light = new DirectionalLight(d.color ?? 0xffffff, d.intensity ?? 1);
    light.position.set(d.position[0], d.position[1], d.position[2]);
    scene.add(light);
  }
}

/**
 * Create a browser app with Three.js renderer, scene, and perspective camera.
 * World convention: Y-up. Games own lighting, art direction, and camera framing.
 */
export function createApp(options: CreateAppOptions): PsgeApp {
  const {
    canvas,
    background = 0x000000,
    antialias = true,
    lighting = false,
    camera: camOpts = {},
  } = options;

  const renderer = new WebGLRenderer({
    canvas,
    antialias,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  scene.background = new Color(background);

  const fov = camOpts.fov ?? 50;
  const near = camOpts.near ?? 0.1;
  const far = camOpts.far ?? 1000;
  const camera = new PerspectiveCamera(fov, 1, near, far);
  const up = camOpts.up ?? ([0, 1, 0] as const);
  camera.up.set(up[0], up[1], up[2]);
  const pos = camOpts.position ?? ([0, 0, 10] as const);
  const look = camOpts.lookAt ?? ([0, 0, 0] as const);
  camera.position.set(pos[0], pos[1], pos[2]);
  camera.lookAt(look[0], look[1], look[2]);

  if (lighting) {
    applyLighting(scene, lighting);
  }

  const loader = new GLTFLoader();
  let rafId = 0;
  let running = false;
  let lastMs = 0;
  let disposed = false;

  const resize = (): void => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  resize();
  window.addEventListener("resize", resize);

  const stopLoop = (): void => {
    running = false;
    cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const app: PsgeApp = {
    scene,
    camera,
    renderer,
    canvas,

    startLoop(update?: (deltaSeconds: number) => void): void {
      if (disposed || running) {
        return;
      }
      running = true;
      lastMs = performance.now();

      const tick = (now: number): void => {
        if (!running) {
          return;
        }
        const delta = clampDelta((now - lastMs) / 1000);
        lastMs = now;
        update?.(delta);
        renderer.render(scene, camera);
        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
    },

    stopLoop,

    async loadGltf(url: string): Promise<Group> {
      const gltf = await loader.loadAsync(url);
      return gltf.scene;
    },

    setCamera({ position, lookAt, up: nextUp }: SetCameraOptions): void {
      const u = nextUp ?? ([0, 1, 0] as const);
      camera.up.set(u[0], u[1], u[2]);
      camera.position.set(position[0], position[1], position[2]);
      camera.lookAt(new Vector3(lookAt[0], lookAt[1], lookAt[2]));
      camera.updateMatrixWorld();
    },

    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      stopLoop();
      window.removeEventListener("resize", resize);
      // Caller owns scene content (meshes, materials). Renderer only.
      renderer.dispose();
    },
  };

  return app;
}
