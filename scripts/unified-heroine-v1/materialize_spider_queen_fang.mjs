// Recreate a real Spider Queen Fang GLB from GitHub-tracked, deterministic
// gzip/base64 chunks. No Blender, Supabase or external binary service needed.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";

const project=process.cwd();
const dir=path.join(project,"scripts/unified-heroine-v1/packed");
const out=path.join(project,"public/characters/unified-heroine-v1/spider-queen-fang-v1-47366a109f16.glb");
const expected="47366a109f16aca0b42d3ebe2bd670626aae56ee432b14ce1fa495f761c05284";
const files=fs.readdirSync(dir).filter(n=>/^spider-queen-fang-v1\.part\d\d\.b64$/.test(n)).sort();
if(files.length!==6)throw new Error("Spider Queen payload requires exactly six versioned parts");
const payload=files.map(n=>fs.readFileSync(path.join(dir,n),"utf8")).join("");
const model=zlib.gunzipSync(Buffer.from(payload,"base64"));
const digest=crypto.createHash("sha256").update(model).digest("hex");
if(digest!==expected)throw new Error("Spider Queen GLB asset checksum mismatch: "+digest);
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,model);
console.log("[spider-queen-fang] verified real GLB",model.length,"bytes",digest.slice(0,12));

