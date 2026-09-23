// Reproducible C1 ingest: retain the source mesh, PBR textures and skin,
// but discard Running/Walking clips and their binary keyframe data.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const [zipPath, outputPath] = process.argv.slice(2);
if (!zipPath || !outputPath) throw new Error("Usage: node scripts/ingest-c1-casual-grace.mjs <zip> <output.glb>");
const entry = "Meshy_AI_Casual_Grace_biped/Meshy_AI_Casual_Grace_biped_Animation_Running_withSkin.glb";
const source = execFileSync("unzip", ["-p", zipPath, entry], { maxBuffer: 32 * 1024 * 1024 });
if (source.toString("ascii", 0, 4) !== "glTF" || source.readUInt32LE(4) !== 2) throw new Error("Invalid source GLB");
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.toString("utf8", 20, 20 + jsonLength));
const binaryOffset = 20 + jsonLength;
if (source.readUInt32LE(binaryOffset + 4) !== 0x004e4942) throw new Error("Expected BIN chunk");
const binary = source.subarray(binaryOffset + 8, binaryOffset + 8 + source.readUInt32LE(binaryOffset));

const usedAccessors = new Set();
for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
  Object.values(primitive.attributes).forEach(index => usedAccessors.add(index));
  if (primitive.indices !== undefined) usedAccessors.add(primitive.indices);
  for (const target of primitive.targets ?? []) Object.values(target).forEach(index => usedAccessors.add(index));
}
for (const skin of gltf.skins ?? []) if (skin.inverseBindMatrices !== undefined) usedAccessors.add(skin.inverseBindMatrices);
const oldAccessors = gltf.accessors;
const accessorIndices = [...usedAccessors].sort((a, b) => a - b);
const accessorMap = new Map(accessorIndices.map((old, index) => [old, index]));
gltf.accessors = accessorIndices.map(index => ({ ...oldAccessors[index] }));
for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
  for (const name of Object.keys(primitive.attributes)) primitive.attributes[name] = accessorMap.get(primitive.attributes[name]);
  if (primitive.indices !== undefined) primitive.indices = accessorMap.get(primitive.indices);
  for (const target of primitive.targets ?? []) for (const name of Object.keys(target)) target[name] = accessorMap.get(target[name]);
}
for (const skin of gltf.skins ?? []) if (skin.inverseBindMatrices !== undefined) {
  skin.inverseBindMatrices = accessorMap.get(skin.inverseBindMatrices);
}

const usedViews = new Set(gltf.accessors.map(accessor => accessor.bufferView).filter(index => index !== undefined));
for (const image of gltf.images ?? []) if (image.bufferView !== undefined) usedViews.add(image.bufferView);
const oldViews = gltf.bufferViews;
const viewIndices = [...usedViews].sort((a, b) => a - b);
const viewMap = new Map(viewIndices.map((old, index) => [old, index]));
const chunks = [];
let offset = 0;
gltf.bufferViews = viewIndices.map(index => {
  const view = oldViews[index];
  const bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  const padding = (4 - (offset % 4)) % 4;
  if (padding) chunks.push(Buffer.alloc(padding));
  offset += padding;
  const next = { ...view, buffer: 0, byteOffset: offset };
  chunks.push(bytes);
  offset += bytes.length;
  return next;
});
for (const accessor of gltf.accessors) if (accessor.bufferView !== undefined) accessor.bufferView = viewMap.get(accessor.bufferView);
for (const image of gltf.images ?? []) if (image.bufferView !== undefined) image.bufferView = viewMap.get(image.bufferView);
delete gltf.animations;
const binaryOutput = Buffer.concat(chunks);
gltf.buffers = [{ byteLength: binaryOutput.length }];

const json = Buffer.from(JSON.stringify(gltf), "utf8");
const jsonPadding = (4 - (json.length % 4)) % 4;
const binPadding = (4 - (binaryOutput.length % 4)) % 4;
const jsonChunk = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);
const binChunk = Buffer.concat([binaryOutput, Buffer.alloc(binPadding)]);
const header = Buffer.alloc(20);
header.write("glTF", 0, "ascii");
header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + jsonChunk.length + 8 + binChunk.length, 8);
header.writeUInt32LE(jsonChunk.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binChunk.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);
const result = Buffer.concat([header, jsonChunk, binHeader, binChunk]);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, result);
console.log(JSON.stringify({ sourceBytes: source.length, sourceSha256: createHash("sha256").update(source).digest("hex"),
  outputBytes: result.length, outputSha256: createHash("sha256").update(result).digest("hex"),
  animations: gltf.animations?.length ?? 0, skinJoints: gltf.skins[0].joints.length }, null, 2));
