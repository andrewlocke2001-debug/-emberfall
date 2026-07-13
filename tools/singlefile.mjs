import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Packs the single-player build into ONE self-contained HTML file that runs
 * offline from anywhere (file://, any static host, an email attachment).
 *
 * Usage (from repo root):
 *   1. SINGLEFILE=1 VITE_SOLO=1 npm run build -w @mmo/client
 *   2. node tools/singlefile.mjs [outPath]
 *
 * Requires the SINGLEFILE vite config (one js bundle, no chunks): each
 * <script src> is inlined as an inline module and modulepreload hints dropped.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "client", "dist");
const out = process.argv[2] ?? join(root, "emberfall-solo.html");

let html = readFileSync(join(dist, "index.html"), "utf8");

// Drop preload hints (everything will be inline).
html = html.replace(/^\s*<link rel="modulepreload"[^>]*>\s*$/gm, "");

// Drop PWA links (manifest/icons): they'd 404 from file:// and the single-file
// build is already a self-contained offline document, so a service worker adds
// nothing here.
html = html.replace(/^\s*<link rel="(?:manifest|apple-touch-icon|icon)"[^>]*>\s*$/gm, "");

// Inline each script src (the singlefile build emits exactly one).
html = html.replace(
  /<script type="module"[^>]*src="\.\/(assets\/[^"]+)"[^>]*><\/script>/g,
  (_m, rel) => {
    let js = readFileSync(join(dist, rel), "utf8");
    js = js.replace(/^\/\/# sourceMappingURL=.*$/gm, "");
    // </script> inside the JS would terminate the inline tag early.
    js = js.replaceAll("</script>", "<\\/script>");
    return `<script type="module">\n${js}\n</script>`;
  },
);

if (/<script[^>]*src=/.test(html)) {
  console.error("[singlefile] a script src survived — was the build made with SINGLEFILE=1?");
  process.exit(1);
}

writeFileSync(out, html);
console.log(`[singlefile] wrote ${out} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
