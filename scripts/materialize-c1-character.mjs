import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const EXPECTED_BYTES = 272_236;
const EXPECTED_SHA256 = "b71c95cbe0d9364d0c135125ad7409ab52672bfd6a190e228eb5b2c3837dd212";
const baseDir = "public/characters/c1-casual-grace";
const inputPath = join(baseDir, "asset-parts", "character.glb.b64.part00.txt");
const outputPath = join(baseDir, "character.glb");
const bytes = Buffer.from(readFileSync(inputPath, "utf8").trim(), "base64");
const sha256 = createHash("sha256").update(bytes).digest("hex");
if (bytes.length !== EXPECTED_BYTES) throw new Error(`C1 character materialization size mismatch: ${bytes.length}`);
if (sha256 !== EXPECTED_SHA256) throw new Error(`C1 character materialization SHA-256 mismatch: ${sha256}`);
if (bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2) throw new Error("C1 materialized character is not a glTF 2.0 GLB");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, bytes);
console.log(JSON.stringify({ outputPath, bytes: bytes.length, sha256 }));
