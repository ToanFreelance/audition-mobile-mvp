/**
 * Isolated Fashion A+B style-lab asset build, never used by gameplay.
 * Generates two original procedural GLBs with identical 17-joint skeleton and
 * one embedded 4-second dance clip each. Build-only Python dependencies.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, copyFileSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const scriptDir = path.join(root, "scripts/fashion-ab-demo");
const builder = path.join(scriptDir, "build_min.py");
const publicDir = path.join(root, "public/tools/fashion-ab-dance-v1");
const cache = path.join(root, ".next/fashion-ab-pydeps");
const names = ["FashionAB_Basic_DanceRig_V1.glb", "FashionAB_Premium_DanceRig_V1.glb"];
const python = process.env.PYTHON_BIN || "python3";

function exec(cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
    stdio: "pipe",
    timeout: 240_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      [cmd, ...args].join(" ") + "\n" +
      String(result.error ?? "") + "\n" + (result.stderr || result.stdout || "").slice(-5000),
    );
  }
  if (result.stdout?.trim()) console.log(result.stdout.trim().slice(-1200));
}

function glbValid(file) {
  if (!existsSync(file) || statSync(file).size < 100_000) return false;
  const b = readFileSync(file);
  return b.toString("ascii", 0, 4) === "glTF" && b.readUInt32LE(4) === 2 &&
    b.readUInt32LE(8) === b.length;
}

mkdirSync(publicDir, { recursive: true });
if (!names.every((name) => glbValid(path.join(publicDir, name)))) {
  mkdirSync(cache, { recursive: true });
  console.log("[FashionAB] Installing build-only Python geometry dependencies...");
  exec(python, [
    "-m", "pip", "install", "--quiet", "--disable-pip-version-check",
    "--target", cache,
    "numpy>=2.0,<3", "trimesh>=4,<6", "scipy>=1.13,<2",
  ]);
  console.log("[FashionAB] Generating skinned Basic / Premium GLBs...");
  exec(python, [builder], {
    PYTHONPATH: cache + (process.env.PYTHONPATH ? path.delimiter + process.env.PYTHONPATH : ""),
  });
  for (const name of names) {
    const generated = path.join(scriptDir, name);
    if (!glbValid(generated)) throw new Error("Invalid generated GLB: " + name);
    copyFileSync(generated, path.join(publicDir, name));
  }
}
for (const name of names) {
  const file = path.join(publicDir, name);
  if (!glbValid(file)) throw new Error("Missing demo asset: " + name);
  console.log("[FashionAB]", name, statSync(file).size, "bytes, sha256",
    createHash("sha256").update(readFileSync(file)).digest("hex"));
}
