import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // Catch the C3 START crash: viewer was evaluated inside synchronous
      // Array.some() before its const declaration (a TypeScript blind spot).
      "@typescript-eslint/no-use-before-define": ["error", {
        functions: false,
        variables: true,
        classes: true,
        enums: true,
        typedefs: true,
        ignoreTypeReferences: true,
      }],
    },
  },
  globalIgnores([
    ".next/**", "out/**", "build/**", "next-env.d.ts",
    "test-results/**", "playwright-report/**", "node_modules/**",
    "public/**", "docs/**",
  ]),
]);
