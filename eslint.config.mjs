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
    "lib/generated/**",
    "design/**",
  ]),
  {
    rules: {
      // Les couvertures sont deja redimensionnees et servies depuis Vercel Blob.
      // L'optimiseur next/image est plafonne a 1000 images sources par mois sur
      // le plan Hobby et renvoie une 402 au-dela (CLAUDE.md, section 5).
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
