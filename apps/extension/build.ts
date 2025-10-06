#!/usr/bin/env bun
import tailwind from "bun-plugin-tailwind";
import { existsSync } from "fs";
import { rm } from "fs/promises";
import path from "path";
import copy from "bun-copy-plugin";

console.log("\n🚀 Starting build process...\n");

const outdir = path.join(process.cwd(), "dist");

if (existsSync(outdir)) {
  console.log(`🗑️ Cleaning previous build at ${outdir}`);
  await rm(outdir, { recursive: true, force: true });
}

const start = performance.now();
const result = await Bun.build({
  entrypoints: [
    path.resolve("src", "contentScript.ts"),
    path.resolve("src", "index.html"),
    path.resolve("src", "popup.html"),
    path.resolve("src", "options.html"),
    path.resolve("src", "background.ts"),
  ],
  outdir,
  plugins: [tailwind, copy("public/", outdir)],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  naming: {
    entry: "[dir]/[name].[ext]",
    chunk: "[dir]/[name].[ext]",
    asset: "[dir]/[name].[ext]",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});

const end = performance.now();

const outputTable = result.outputs.map((output) => ({
  File: path.relative(process.cwd(), output.path),
  Type: output.kind,
}));

console.table(outputTable);
const buildTime = (end - start).toFixed(2);

console.log(`\n✅ Build completed in ${buildTime}ms\n`);
