import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entryPoints: ["src/**/*.ts"],
  outdir: "dist",
  format: "esm",
  outbase: "src",
  bundle: true,
  platform: "neutral",
  minify: !options.watch,
  sourcemap: true,
  clean: true,
  onSuccess: "tsc --emitDeclarationOnly --declaration",
}));
