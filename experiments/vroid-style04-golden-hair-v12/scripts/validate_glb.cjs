const fs = require("node:fs");
const path = require("node:path");
const validator = require(process.env.GLTF_VALIDATOR || "gltf-validator");
const root = path.resolve(__dirname, "..");

async function validate() {
  const file = path.join(root, "out", "Vita-Style04-Golden-Hair-V12.glb");
  const bytes = new Uint8Array(fs.readFileSync(file));
  const result = await validator.validateBytes(bytes, { maxIssues: 450 });
  const counts = {};
  for (const issue of result.issues.messages) {
    counts[issue.code] = (counts[issue.code] || 0) + 1;
  }
  const report = {
    version: result.validatorVersion,
    errors: result.issues.numErrors, warnings: result.issues.numWarnings,
    infos: result.issues.numInfos, counts, issuesTruncated: result.issues.truncated
  };
  fs.writeFileSync(path.join(root, "review", "gltf-validator.json"), JSON.stringify(report, null, 2));
  if (report.errors) process.exitCode = 1;
}
validate().catch(e => { console.error(e); process.exitCode = 1; });
