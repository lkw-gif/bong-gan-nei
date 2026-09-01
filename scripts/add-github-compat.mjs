import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outputDir = join(process.cwd(), "dist-github");
const assetsDir = join(outputDir, "assets");
const oldCssDir = join(outputDir, "_next", "static", "css");
const oldChunksDir = join(outputDir, "_next", "static", "chunks");

const assets = await readdir(assetsDir);
const currentCss = assets.find(
  (filename) => filename.startsWith("index-") && filename.endsWith(".css"),
);

if (!currentCss) {
  throw new Error("Could not find the GitHub Pages CSS bundle.");
}

await mkdir(oldCssDir, { recursive: true });
await mkdir(oldChunksDir, { recursive: true });

// The first GitHub Pages release cached HTML that pointed at Vinext assets in
// the wrong directory. Keep these aliases for one release cycle so that those
// cached pages regain their styling and refresh themselves to the Vite build.
await copyFile(
  join(assetsDir, currentCss),
  join(oldCssDir, "index.DBXY3Wh9.css"),
);

const redirectModule = `
const url = new URL(window.location.href);
if (url.searchParams.get("__refresh") !== "github-pages-v3") {
  url.searchParams.set("__refresh", "github-pages-v3");
  window.location.replace(url);
}
`;

await writeFile(
  join(oldChunksDir, "index-Cc7ipCqu.js"),
  redirectModule.trimStart(),
  "utf8",
);

for (const filename of [
  "rolldown-runtime-DnIy06GJ.js",
  "framework-B-ArkUqH.js",
  "layout-segment-context-CZje6xHB.js",
  "page-uorOMq0V.js",
]) {
  await writeFile(join(oldChunksDir, filename), "export {};\n", "utf8");
}

console.log("Added compatibility assets for cached GitHub Pages HTML.");
