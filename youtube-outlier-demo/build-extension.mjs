import { build } from "esbuild";
import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const extension = path.join(root, "extension");
const dist = path.join(extension, "dist");

await rm(dist, { recursive: true, force: true });
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
await cp(path.join(root, "..", "public", "stanley-mascot-dashboard.png"), path.join(dist, "stanley-mascot-dashboard.png"));
await cp(path.join(root, "..", "public", "stanley-channel-robot.png"), path.join(dist, "stanley-channel-robot.png"));
