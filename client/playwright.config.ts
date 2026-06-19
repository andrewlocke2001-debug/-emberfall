import { defineConfig, devices } from "@playwright/test";

const CLIENT_PORT = 4173;
const SERVER_PORT = 2567;

/**
 * E2E runs against the production client build (`vite preview`) talking to a
 * real Colyseus server. Both are started as webServers below; on a dev machine
 * an already-running server/preview is reused.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    trace: "retain-on-failure",
    viewport: { width: 1024, height: 768 },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Headless Chromium WebGL can fail framebuffer attachment; force the
        // Canvas renderer path by disabling the GPU (Phaser type: AUTO falls back).
        launchOptions: { args: ["--disable-gpu", "--disable-software-rasterizer"] },
      },
    },
  ],
  webServer: [
    {
      command: "npm start -w @mmo/server",
      cwd: "..",
      port: SERVER_PORT,
      reuseExistingServer: !process.env["CI"],
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
      // "GameMaster" is a GM in tests so gm.spec/inventory.spec can exercise
      // role-gated commands. It's a *registered* account in tests (enterWorldAsGm)
      // for stable identity across runs. (Other env — DATABASE_URL etc. — is
      // loaded from server/.env at runtime.)
      env: { GM_USERNAMES: "GameMaster" },
    },
    {
      command: "npm run build -w @mmo/client && npm run preview -w @mmo/client -- --port 4173 --strictPort",
      cwd: "..",
      url: `http://localhost:${CLIENT_PORT}`,
      reuseExistingServer: !process.env["CI"],
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
