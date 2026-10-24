import { build } from "esbuild";

await build({
  entryPoints: ["server/api-handler.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "api/index.mjs",
  packages: "external",
  tsconfig: "tsconfig.json",
  alias: {
    "@shared": "./shared",
  },
  banner: {
    js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
  },
});

console.log("API bundled successfully");
