/**
 * Generate a simple house/shed GLB for Milestone 1 without Blender.
 * Recipe: ordinary box meshes via @gltf-transform/core.
 *
 * Usage (from repo root or this package):
 *   npm run generate:assets -w @psge/endless-dig
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Document, NodeIO } from "@gltf-transform/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../assets/models");
const outFile = path.join(outDir, "surface-prop.glb");
const recipeFile = path.join(outDir, "surface-prop.recipe.json");

/** Axis-aligned box centered at origin before transform. */
function boxGeometry(sx, sy, sz) {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const positions = new Float32Array([
    // front
    -hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz,
    // back
    hx, -hy, -hz, -hx, -hy, -hz, -hx, hy, -hz, hx, hy, -hz,
    // top
    -hx, hy, hz, hx, hy, hz, hx, hy, -hz, -hx, hy, -hz,
    // bottom
    -hx, -hy, -hz, hx, -hy, -hz, hx, -hy, hz, -hx, -hy, hz,
    // right
    hx, -hy, hz, hx, -hy, -hz, hx, hy, -hz, hx, hy, hz,
    // left
    -hx, -hy, -hz, -hx, -hy, hz, -hx, hy, hz, -hx, hy, -hz,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14,
    15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
  ]);
  return { positions, indices };
}

function addBoxMesh(doc, buffer, name, color, sx, sy, sz, translation) {
  const { positions, indices } = boxGeometry(sx, sy, sz);
  const position = doc
    .createAccessor(`${name}Pos`)
    .setType("VEC3")
    .setArray(positions)
    .setBuffer(buffer);
  const index = doc
    .createAccessor(`${name}Idx`)
    .setType("SCALAR")
    .setArray(indices)
    .setBuffer(buffer);
  const material = doc
    .createMaterial(name)
    .setBaseColorFactor([...color, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.85);
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", position)
    .setIndices(index)
    .setMaterial(material);
  const mesh = doc.createMesh(name).addPrimitive(prim);
  return doc.createNode(name).setMesh(mesh).setTranslation(translation);
}

async function main() {
  const doc = new Document();
  const buffer = doc.createBuffer();

  const root = doc.createNode("SurfaceProp");
  root.addChild(
    addBoxMesh(doc, buffer, "Body", [0.78, 0.55, 0.38], 2.2, 1.6, 1.6, [0, 0.8, 0]),
  );
  root.addChild(
    addBoxMesh(doc, buffer, "Roof", [0.45, 0.22, 0.18], 2.6, 0.45, 1.9, [0, 1.85, 0]),
  );
  root.addChild(
    addBoxMesh(doc, buffer, "Chimney", [0.35, 0.35, 0.35], 0.35, 0.7, 0.35, [
      0.7, 2.2, -0.2,
    ]),
  );
  root.addChild(
    addBoxMesh(doc, buffer, "Door", [0.25, 0.18, 0.12], 0.45, 0.9, 0.08, [
      0, 0.45, 0.82,
    ]),
  );

  doc.createScene("Scene").addChild(root);

  await mkdir(outDir, { recursive: true });
  const io = new NodeIO();
  await io.write(outFile, doc);

  const recipe = {
    id: "surface-prop",
    type: "model",
    runtime: "surface-prop.glb",
    generator: "scripts/generate-surface-prop.mjs",
    description:
      "Milestone 1 cottage prop: body, roof, chimney, door boxes. Regenerated without Blender.",
    scale: 1.0,
    command: "npm run generate:assets -w @psge/endless-dig",
  };
  await writeFile(recipeFile, `${JSON.stringify(recipe, null, 2)}\n`, "utf8");

  console.log(`Wrote ${outFile}`);
  console.log(`Wrote ${recipeFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
