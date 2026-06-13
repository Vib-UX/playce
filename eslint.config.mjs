import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Third-party skill bundles checked into the repo.
    ".agents/**",
    // Foundry project (Solidity + vendored JS libs) — not part of the web lint.
    "contracts/**",
  ]),
  {
    rules: {
      // Mount-guard (`useEffect(() => setMounted(true), [])`) and one-shot
      // reveal toggles are intentional, hydration-safe patterns here.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
