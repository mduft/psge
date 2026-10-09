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

export interface CreateAppOptions {
  canvas: HTMLCanvasElement;
  /** CSS or hex background color. */
  background?: string | number;
  /** Vertical field of view in degrees. */
  fov?: number;
}

export interface SetCameraOptions {
  position: readonly [number, number, number];
  lookAt: readonly [number, number, number];
}

export interface PsgeApp {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  startLoop(update?: (deltaSeconds: number) => void): void;
  loadGltf(url: string): Promise<Group>;
  setCamera(options: SetCameraOptions): void;
  dispose(): void;
}

/**
 * Create a browser app with Three.js renderer, scene, and locked camera.
 * World convention: Y-up, excavation depth along −Y.
 */
export function createApp(options: CreateAppOptions): PsgeApp {
  const { canvas, background = 0x87b7e0, fov = 36 } = options;

  const renderer = new WebGLRenderer({
    canvas,
    antialias: false, // chunky pixels read better for block style
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  scene.background = new Color(background);

  const camera = new PerspectiveCamera(fov, 1, 0.1, 400);
  camera.up.set(0, 1, 0);
  camera.position.set(8, -2, 22);
  camera.lookAt(0, -4, -2);

  scene.add(new HemisphereLight(0xe8f2ff, 0x4a3424, 0.85));
  scene.add(new AmbientLight(0xffffff, 0.45));
  const sun = new DirectionalLight(0xfff2d8, 1.25);
  sun.position.set(10, 28, 18);
  scene.add(sun);
  const fill = new DirectionalLight(0xb8d4ff, 0.35);
  fill.position.set(-12, 10, 8);
  scene.add(fill);

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

    async loadGltf(url: string): Promise<Group> {
      const gltf = await loader.loadAsync(url);
      return gltf.scene;
    },

    setCamera({ position, lookAt }: SetCameraOptions): void {
      camera.up.set(0, 1, 0);
      camera.position.set(position[0], position[1], position[2]);
      camera.lookAt(new Vector3(lookAt[0], lookAt[1], lookAt[2]));
      camera.updateMatrixWorld();
    },

    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      renderer.dispose();
    },
  };

  return app;
}
