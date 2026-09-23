// C1.1 offline art pass: compact an animation-free, rigged Casual Grace GLB.
// Keep original vertices/normals/tangents/UVs/weights at every surviving index;
// lock head and hands to avoid sacrificing facial/finger topology.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const [inputPath, outputPath, desiredTriangles = "42000"] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: node scripts/ingest-c1-1-casual-grace.mjs <animation-free-source.glb> <output.glb> [triangles]");
}
const source = readFileSync(inputPath);
if (source.toString("ascii", 0, 4) !== "glTF" || source.readUInt32LE(4) !== 2) throw new Error("Expected glTF 2.0 GLB");
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.toString("utf8", 20, 20 + jsonLength));
const binaryOffset = 20 + jsonLength;
if (source.readUInt32LE(binaryOffset + 4) !== 0x004e4942) throw new Error("Expected BIN chunk");
const binary = source.subarray(binaryOffset + 8, binaryOffset + 8 + source.readUInt32LE(binaryOffset));
if (gltf.animations?.length || gltf.meshes.length !== 1 || gltf.meshes[0].primitives.length !== 1 || gltf.skins?.length !== 1) {
  throw new Error("C1.1 expects one animation-free, skinned source primitive");
}
const primitive = gltf.meshes[0].primitives[0];
const attrs = primitive.attributes;
const oldViews = gltf.bufferViews;
const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const bytesPerComponent = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const readAccessor = index => {
  const accessor = gltf.accessors[index];
  const view = oldViews[accessor.bufferView];
  const type = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[accessor.componentType];
  if (!type || accessor.sparse || (view.byteStride && view.byteStride !== components[accessor.type] * bytesPerComponent[accessor.componentType])) {
    throw new Error("Unexpected strided/sparse accessor");
  }
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const length = accessor.count * components[accessor.type];
  return new type(Uint8Array.from(binary.subarray(start, start + length * type.BYTES_PER_ELEMENT)).buffer);
};
const sourceVertexCount = gltf.accessors[attrs.POSITION].count;
const positions = readAccessor(attrs.POSITION);
const normals = readAccessor(attrs.NORMAL);
const uv = readAccessor(attrs.TEXCOORD_0);
const joints = readAccessor(attrs.JOINTS_0);
const weights = readAccessor(attrs.WEIGHTS_0);
const indices = readAccessor(primitive.indices);
const skin = gltf.skins[0];
const headJoint = skin.joints.findIndex(node => /mixamorig:Head$/.test(gltf.nodes[node].name ?? ""));
const handJoints = new Set(skin.joints.flatMap((node, index) =>
  /mixamorig:(?:LeftHand|RightHand)$/.test(gltf.nodes[node].name ?? "") ? [index] : []));
if (headJoint < 0 || handJoints.size !== 2) throw new Error("C1.1 source head/hand protection rig is missing");
const vertexLocks = new Uint8Array(sourceVertexCount);
const attributes = new Float32Array(sourceVertexCount * 9);
let protectedVertices = 0;
for (let i = 0; i < sourceVertexCount; i++) {
  for (let j = 0; j < 4; j++) {
    if (handJoints.has(joints[4 * i + j]) && weights[4 * i + j] >= 0.35) vertexLocks[i] = 1;
    if (joints[4 * i + j] === headJoint && weights[4 * i + j] >= 0.35
      && positions[3 * i + 1] >= 1.38 && positions[3 * i + 2] >= 0.025
      && Math.abs(positions[3 * i]) < 0.16) vertexLocks[i] = 1;
    attributes[9 * i + 5 + j] = weights[4 * i + j];
  }
  protectedVertices += vertexLocks[i];
  attributes.set(normals.subarray(3 * i, 3 * i + 3), 9 * i);
  attributes.set(uv.subarray(2 * i, 2 * i + 2), 9 * i + 3);
}
await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true;
const [simplified, error] = MeshoptSimplifier.simplifyWithAttributes(
  indices, positions, 3, attributes, 9,
  [0.15, 0.15, 0.15, 0.25, 0.25, 0.12, 0.12, 0.12, 0.12],
  vertexLocks, Math.floor(Number(desiredTriangles)) * 3, 0.055,
);
const precompactIndices = simplified.slice();
const [remap, vertexCount] = MeshoptSimplifier.compactMesh(simplified);
const expectedNewPositions = new Float32Array(vertexCount * 3);
for (let oldIndex = 0; oldIndex < remap.length; oldIndex++) {
  if (remap[oldIndex] !== 0xffffffff) expectedNewPositions.set(positions.subarray(oldIndex * 3, oldIndex * 3 + 3), remap[oldIndex] * 3);
}
function maximumEdgeLength(indexData, positionData) {
  let maximum = 0;
  for (let i = 0; i < indexData.length; i += 3) for (let side = 0; side < 3; side++) {
    const a = indexData[i + side] * 3;
    const b = indexData[i + (side + 1) % 3] * 3;
    maximum = Math.max(maximum, Math.hypot(positionData[a] - positionData[b], positionData[a + 1] - positionData[b + 1], positionData[a + 2] - positionData[b + 2]));
  }
  return maximum;
}
const sourceMaxEdge = maximumEdgeLength(indices, positions);
const outputMaxEdge = maximumEdgeLength(simplified, expectedNewPositions);
for (let i = 0; i < simplified.length; i++) {
  if (remap[precompactIndices[i]] !== simplified[i]) {
    throw new Error(`Vertex remap mismatch at ${i}: ${precompactIndices[i]} -> ${remap[precompactIndices[i]]}, got ${simplified[i]}`);
  }
}
if (outputMaxEdge > sourceMaxEdge * 4) throw new Error(`C1.1 simplification stretches triangles: ${sourceMaxEdge} -> ${outputMaxEdge} (before compact: ${maximumEdgeLength(precompactIndices, positions)})`);
const chunks = [];
let length = 0;
function addView(data, target) {
  const pad = (4 - length % 4) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); length += pad; }
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const index = gltf.bufferViews.length;
  gltf.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: buffer.length, ...(target ? { target } : {}) });
  chunks.push(buffer); length += buffer.length;
  return index;
}
// The old GLB's buffer views are replaced, and only the remaining accessors
// (six attributes, indices and inverse-bind matrices) are retained.
gltf.bufferViews = [];
for (const [name, accessorIndex] of Object.entries(attrs)) {
  const accessor = gltf.accessors[accessorIndex];
  const original = readAccessor(accessorIndex);
  const width = components[accessor.type];
  const reduced = new original.constructor(vertexCount * width);
  for (let oldIndex = 0; oldIndex < remap.length; oldIndex++) {
    if (remap[oldIndex] === 0xffffffff) continue;
    reduced.set(original.subarray(oldIndex * width, (oldIndex + 1) * width), remap[oldIndex] * width);
  }
  accessor.bufferView = addView(reduced, 34962);
  accessor.byteOffset = 0;
  accessor.count = vertexCount;
  if (name === "POSITION") {
    accessor.min = [Infinity, Infinity, Infinity];
    accessor.max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < reduced.length; i += 3) for (let axis = 0; axis < 3; axis++) {
      accessor.min[axis] = Math.min(accessor.min[axis], reduced[i + axis]);
      accessor.max[axis] = Math.max(accessor.max[axis], reduced[i + axis]);
    }
  }
}
const indexAccessor = gltf.accessors[primitive.indices];
indexAccessor.bufferView = addView(simplified, 34963);
indexAccessor.byteOffset = 0;
indexAccessor.count = simplified.length;
indexAccessor.componentType = 5125;
const inverse = gltf.accessors[skin.inverseBindMatrices];
const oldInverseView = oldViews[inverse.bufferView];
const inverseOffset = (oldInverseView.byteOffset ?? 0) + (inverse.byteOffset ?? 0);
inverse.bufferView = addView(binary.subarray(inverseOffset, inverseOffset + skin.joints.length * 64));
inverse.byteOffset = 0;
for (const image of gltf.images) {
  const view = oldViews[image.bufferView];
  const texture = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  const resized = await sharp(texture).resize(1024, 1024, { fit: "fill", kernel: "lanczos3" })
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
  image.bufferView = addView(resized);
  image.mimeType = "image/jpeg";
}
const bin = Buffer.concat(chunks);
gltf.buffers = [{ byteLength: bin.length }];
const json = Buffer.from(JSON.stringify(gltf));
const jsonChunk = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
const binChunk = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]);
const header = Buffer.alloc(20);
header.write("glTF", 0, "ascii");
header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + jsonChunk.length + 8 + binChunk.length, 8);
header.writeUInt32LE(jsonChunk.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binChunk.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);
const output = Buffer.concat([header, jsonChunk, binHeader, binChunk]);
writeFileSync(outputPath, output);
console.log(JSON.stringify({
  sourceBytes: source.length, sourceSha256: createHash("sha256").update(source).digest("hex"),
  outputBytes: output.length, outputSha256: createHash("sha256").update(output).digest("hex"),
  sourceVertices: sourceVertexCount, outputVertices: vertexCount,
  sourceTriangles: indices.length / 3, outputTriangles: simplified.length / 3,
  protectedVertices, relativeSimplificationError: error, textures: gltf.images.length,
  maximumEdgeLength: outputMaxEdge,
  textureSize: 1024, joints: skin.joints.length, animations: gltf.animations?.length ?? 0,
}, null, 2));
