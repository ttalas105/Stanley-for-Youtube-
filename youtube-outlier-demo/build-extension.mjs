import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const extension = path.join(root, "extension");
const dist = path.join(extension, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, "vendor"), { recursive: true });
await build({
  entryPoints: {
    content: path.join(extension, "content.ts"),
    background: path.join(extension, "background.ts"),
    popup: path.join(extension, "popup.ts"),
  },
  outdir: dist,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome110",
  sourcemap: true,
});
for (const file of ["manifest.json", "popup.html", "content.css"]) await cp(path.join(extension, file), path.join(dist, file));
for (const file of ["chart.umd.min.js", "Chart.js.LICENSE.md"]) await cp(path.join(extension, "vendor", file), path.join(dist, "vendor", file));
