import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerIpc } from "./ipc";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// vite-plugin-electron sets this in dev; undefined in a packaged build.
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 720,
    webPreferences: {
      preload: path.join(dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // signInWithPopup (Google OAuth) needs a real popup window; Electron
  // denies window.open by default, so explicitly allow it for Google's
  // consent screen and Firebase's auth-handler redirect.
  win.webContents.setWindowOpenHandler(({ url }) => {
    const allowed =
      url.startsWith("https://accounts.google.com/") ||
      url.includes(".firebaseapp.com/__/auth/handler");
    return allowed ? { action: "allow" } : { action: "deny" };
  });

  if (DEV_SERVER_URL) {
    void win.loadURL(DEV_SERVER_URL);
  } else {
    void win.loadFile(path.join(dirname, "../dist-export-app/index.html"));
  }
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
});

app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
