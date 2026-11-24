// QA-only HTTPS server for the real production build. Never used by Vercel.
import { createServer } from "node:https";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import next from "next";

if (process.env.SECURITY_AUTH_REAL_QA !== "1" || !process.env.QA_TLS_DIR) {
  throw new Error("Isolated security QA TLS configuration required");
}
process.env.NODE_ENV = "production";
const hostname = "127.0.0.1";
const port = 3443;
const app = next({ dev: false, hostname, port });
await app.prepare();
const handle = app.getRequestHandler();
createServer({
  key: readFileSync(join(process.env.QA_TLS_DIR, "key.pem")),
  cert: readFileSync(join(process.env.QA_TLS_DIR, "cert.pem")),
}, (req, res) => {
  // This listener is the trusted TLS edge, not caller-provided proxy metadata.
  req.headers["x-forwarded-proto"] = "https";
  req.headers["x-forwarded-host"] = req.headers.host;
  req.headers["x-forwarded-port"] = String(port);
  void handle(req, res);
}).listen(port, hostname, () => console.log("Security QA HTTPS ready"));
