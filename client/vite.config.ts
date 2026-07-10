import { defineConfig } from "vite";

// SINGLEFILE=1 produces ONE js bundle (no chunks, no sourcemap) so
// tools/singlefile.mjs can inline it into a self-contained offline HTML —
// the "send a friend one file" build of single-player.
const singleFile = process.env["SINGLEFILE"] === "1";

export default defineConfig({
  base: "./",
  server: { host: true, port: 5173 },
  preview: { port: 4173 },
  // @mmo/shared is consumed as TypeScript source (not a pre-built package), so
  // let Vite process it directly instead of trying to pre-bundle it.
  optimizeDeps: { exclude: ["@mmo/shared"] },
  build: {
    target: "es2020",
    sourcemap: !singleFile,
    rollupOptions: {
      output: singleFile
        ? { inlineDynamicImports: true }
        : {
            // Split Phaser into its own chunk — large and slow-changing, so game
            // code can redeploy without busting the framework cache.
            manualChunks: (id) => (id.includes("node_modules/phaser") ? "phaser" : undefined),
          },
    },
    chunkSizeWarningLimit: 1600,
  },
});
