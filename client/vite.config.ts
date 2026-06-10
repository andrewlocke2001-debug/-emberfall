import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { host: true, port: 5173 },
  preview: { port: 4173 },
  // @mmo/shared is consumed as TypeScript source (not a pre-built package), so
  // let Vite process it directly instead of trying to pre-bundle it.
  optimizeDeps: { exclude: ["@mmo/shared"] },
  build: {
    target: "es2020",
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split Phaser into its own chunk — large and slow-changing, so game
        // code can redeploy without busting the framework cache.
        manualChunks: (id) => (id.includes("node_modules/phaser") ? "phaser" : undefined),
      },
    },
    chunkSizeWarningLimit: 1600,
  },
});
