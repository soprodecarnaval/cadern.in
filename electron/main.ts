import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPORT_DEEP_LINK_PROTOCOL,
  findExportDeepLinkArg,
  parseExportDeepLink,
  type ExportDeepLinkContext,
} from "../types/exportDeepLink";
import { registerIpc } from "./ipc";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// vite-plugin-electron sets this in dev; undefined in a packaged build.
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let win: BrowserWindow | null = null;

// Set by a cold-launch argv or a warm `open-url`/`second-instance` before the
// renderer has a chance to ask for it; cleared once delivered (010).
let pendingExportContext: ExportDeepLinkContext | null = null;

export function takePendingExportContext(): ExportDeepLinkContext | null {
  const context = pendingExportContext;
  pendingExportContext = null;
  return context;
}

function deliverExportContext(url: string) {
  const context = parseExportDeepLink(url);
  if (!context) {
    return;
  }
  if (win && !win.webContents.isLoading()) {
    win.webContents.send("export-context", context);
  } else {
    pendingExportContext = context;
  }
  win?.focus();
}

// Dev mode runs through `electron .`, not a packaged app, so registration
// needs the exec path + script args Windows/Linux use to relaunch it.
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(
      EXPORT_DEEP_LINK_PROTOCOL,
      process.execPath,
      [path.resolve(process.argv[1])],
    );
  }
} else {
  app.setAsDefaultProtocolClient(EXPORT_DEEP_LINK_PROTOCOL);
}

// Windows/Linux deliver the link as a launch argument, so a second instance
// (the OS always starts one on a link click) must hand it to the first and
// exit — there is only ever one export window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", (_event, argv) => {
  const url = findExportDeepLinkArg(argv);
  if (url) {
    deliverExportContext(url);
  }
});

// macOS delivers the link through this event instead, cold or warm.
app.on("open-url", (event, url) => {
  event.preventDefault();
  deliverExportContext(url);
});

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

  // Firebase's own "popup was closed" detection polls window.closed, which
  // doesn't reliably propagate back across Electron's window.open bridge —
  // closing the OAuth popup without finishing leaves signInWithPopup's
  // promise pending forever. Tell the renderer directly instead.
  win.webContents.on("did-create-window", (childWindow) => {
    childWindow.once("closed", () => {
      win?.webContents.send("oauth-popup-closed");
    });
  });

  if (DEV_SERVER_URL) {
    void win.loadURL(DEV_SERVER_URL);
  } else {
    void win.loadFile(path.join(dirname, "../dist-export-app/index.html"));
  }
}

void app.whenReady().then(() => {
  registerIpc({ getPendingExportContext: takePendingExportContext });
  createWindow();

  // Windows/Linux cold launch: the link is this instance's own argv, not a
  // second-instance event.
  const url = findExportDeepLinkArg(process.argv);
  if (url) {
    deliverExportContext(url);
  }
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
