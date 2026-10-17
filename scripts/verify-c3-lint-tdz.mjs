import assert from "node:assert/strict";
import { ESLint } from "eslint";

// A synthetic reproduction of the exact C3 crash. ESLint must fail even
// though TypeScript accepts a synchronous callback that captures a later const.
const eslint = new ESLint();
const messages = await eslint.lintText(`
const matchStartSession = { participants: [{ id: "host" }] };
const loaded = matchStartSession?.participants.some(
  participant => participant.id === viewer.id
);
const viewer = { id: "host" };
void loaded;
`, { filePath: "components/multiplayer/WaitingRoomPanel.tsx" });
const matching = messages.flatMap(result => result.messages).filter(
  message => message.ruleId === "@typescript-eslint/no-use-before-define"
    && message.severity === 2,
);
assert.ok(matching.length > 0, "ESLint must reject a pre-declaration viewer reference");
console.log("C3 lint TDZ regression: PASS");
