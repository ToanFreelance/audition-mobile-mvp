import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test } from "@playwright/test";
import * as ts from "typescript";
import { RoomMetadataTransportError } from "../multiplayer/room-metadata-retry";
const source = readFileSync("components/multiplayer/WaitingRoomPanel.tsx", "utf8");
const start = source.indexOf("async function postRoomMutation");
const end = source.indexOf("\nfunction ", source.indexOf("async function fetchRoomSnapshot"));
if (start < 0 || end < start) throw Error("HTTP helpers not found");
const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
for (const fault of ["503", "429", "AbortError", "lost-json", "domain-400", "conflict"]) {
  test(`production HTTP classification: ${fault}`, async () => {
    const snapshot = { revision: 7 }; let cleared = 0;
    const promise = runInNewContext(code + "\npostRoomMutation({action:'loaded'});", {
      RoomMetadataTransportError, Error, SyntaxError, DOMException, AbortController,
      isCanonicalRoomSnapshot: () => true,
      window: { setTimeout: () => 1, clearTimeout: () => { cleared++; } },
      fetch: async () => {
        if (fault === "AbortError") throw new DOMException("timeout", "AbortError");
        const status = fault === "503" ? 503 : fault === "429" ? 429 : fault === "domain-400" ? 400 : 200;
        return { status, ok: status === 200, json: async () => {
          if (fault === "lost-json") throw new SyntaxError("body interrupted");
          return fault === "domain-400" ? { ok: false, error: "Frozen content invalid" } : { ok: true, snapshot, conflict: fault === "conflict" };
        } };
      },
    });
    // Normalize a cross-realm promise before using host-realm matchers.
    const outcome = await Promise.resolve(promise).then(value => ({ value, error: null }), error => ({ value: null, error }));
    if (fault === "conflict") expect(outcome.value).toEqual({ snapshot, conflict: true });
    else if (fault === "domain-400") { expect(outcome.error.message).toContain("Frozen content"); expect(outcome.error).not.toBeInstanceOf(RoomMetadataTransportError); }
    else expect(outcome.error).toBeInstanceOf(RoomMetadataTransportError);
    expect(cleared).toBe(1);
  });
}
