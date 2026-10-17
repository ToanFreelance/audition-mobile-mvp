import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const noUseBeforeDefine = ["error", {
  functions: false, variables: true, classes: true, enums: true,
  typedefs: true, ignoreTypeReferences: true,
}];

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // Baseline existing code separately; don't silently refactor old animation,
  // stage or gameplay architecture just to adopt a new lint gate in C3.
  // Existing warnings remain visible with npm run lint:report.
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs}"],
    rules: {
      "@typescript-eslint/no-use-before-define": ["warn", noUseBeforeDefine[1]],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@next/next/no-location-assign-relative-destination": "warn",
      "@next/next/no-assign-module-variable": "warn",
      "prefer-const": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  // C3 runtime is protected by a strict gate. It catches the prior render
  // crash where .some() synchronously dereferenced a later const viewer.
  {
    files: ["components/multiplayer/**/*.{ts,tsx}", "app/tools/c3-*/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-use-before-define": noUseBeforeDefine,
      "react-hooks/rules-of-hooks": "error",
    },
  },
  globalIgnores([
    ".next/**", "out/**", "build/**", "next-env.d.ts",
    "test-results/**", "playwright-report/**", "node_modules/**",
    "public/**", "docs/**",
  ]),
]);
