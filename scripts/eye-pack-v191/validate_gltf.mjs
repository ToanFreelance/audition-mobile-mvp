import fs from "node:fs";
import validator from "gltf-validator";
const [asset, output] = process.argv.slice(2);
const report = await validator.validateBytes(new Uint8Array(fs.readFileSync(asset)), { maxIssues: 2000 });
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ errors: report.issues.numErrors, warnings: report.issues.numWarnings, codes: [...new Set(report.issues.messages.map(m => m.code))] }));
if (report.issues.numErrors) process.exitCode = 1;
