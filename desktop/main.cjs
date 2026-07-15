/**
 * Emberfall desktop shell (Steam build). Wraps the self-contained
 * single-player client (built with VITE_SOLO=1, copied into ./app) in a
 * frameless-friendly Electron window.
 *
 * Design notes:
 * - The game is fully offline (procedural art, localStorage saves), so the
 *   shell is intentionally thin: no remote content, no auto-update, web
 *   security on, node integration off.
 * - Steamworks SDK integration (achievements/overlay hooks via steamworks.js)
 *   is a follow-up once an App ID exists; Steam can ship this build as-is.
 * - EMBERFALL_SMOKE=1 runs a headless-ish self-check: load the app, verify
 *   the login screen exists, print SMOKE_OK, and exit — used by CI/audits.
 */
const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

const SMOKE = process.env.EMBERFALL_SMOKE === "1";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: !SMOKE,
    backgroundColor: "#0b0e14",
    autoHideMenuBar: true,
    title: "Emberfall",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // The game is a local, self-contained page.
  void win.loadFile(path.join(__dirname, "app", "index.html"));

  // Any external link (none today, but future credits/links) opens in the
  // player's browser, never inside the game shell.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  if (SMOKE) {
    win.webContents.once("did-finish-load", async () => {
      try {
        const ok = await win.webContents.executeJavaScript(
          "Boolean(document.getElementById('login') && document.getElementById('enter'))",
        );
        console.log(ok ? "SMOKE_OK" : "SMOKE_FAIL:login-screen-missing");
        app.exit(ok ? 0 : 1);
      } catch (err) {
        console.log("SMOKE_FAIL:" + (err && err.message));
        app.exit(1);
      }
    });
    win.webContents.once("did-fail-load", (_e, code, desc) => {
      console.log(`SMOKE_FAIL:did-fail-load:${code}:${desc}`);
      app.exit(1);
    });
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
