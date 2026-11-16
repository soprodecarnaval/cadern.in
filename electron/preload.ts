import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("api", {
  getMscorePath: () => ipcRenderer.invoke("mscore:get"),
  setMscorePath: (mscorePath: string) =>
    ipcRenderer.invoke("mscore:set", mscorePath),
  locateMscore: () => ipcRenderer.invoke("mscore:locate"),
  pickMscz: () => ipcRenderer.invoke("dialog:pickMscz"),
  getDroppedPath: (file: File) => webUtils.getPathForFile(file),
  readScoreMeta: (msczPath: string) =>
    ipcRenderer.invoke("score:readMeta", msczPath),
  copyMsczWithMeta: (
    sourcePath: string,
    destinationPath: string,
    tags: import("../scripts/lib/msczMeta").MetadataTags,
  ) =>
    ipcRenderer.invoke(
      "score:copyWithMeta",
      sourcePath,
      destinationPath,
      tags,
    ),
  stampMsczBytes: (
    bytes: Uint8Array,
    identity: import("../types/metajson").ScoreIdentity,
  ) => ipcRenderer.invoke("score:stampMsczBytes", bytes, identity),
  stampMsczFile: (
    msczPath: string,
    identity: import("../types/metajson").ScoreIdentity,
  ) => ipcRenderer.invoke("score:stampMsczFile", msczPath, identity),
  runExport: (
    options: Omit<
      import("../scripts/lib/exportScore").RunExportOptions,
      "mscorePath" | "destinationDirectory"
    >,
  ) => ipcRenderer.invoke("score:runExport", options),
  readExportFolder: (folderPath: string) =>
    ipcRenderer.invoke("score:readExportFolder", folderPath),
  openFolder: (folderPath: string) =>
    ipcRenderer.invoke("shell:openFolder", folderPath),
  openMuseScoreDownload: () => ipcRenderer.invoke("shell:openMuseScoreDownload"),
  onOAuthPopupClosed: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("oauth-popup-closed", listener);
    return () => ipcRenderer.removeListener("oauth-popup-closed", listener);
  },
  // Cold launch: a deep link already parsed before the renderer asked.
  getExportContext: () => ipcRenderer.invoke("export:getContext"),
  // Warm launch (second-instance / macOS open-url) while the window was
  // already open; returns an unsubscribe fn.
  onExportContext: (
    callback: (
      context: import("../types/exportDeepLink").ExportDeepLinkContext,
    ) => void,
  ) => {
    const listener = (
      _e: unknown,
      context: import("../types/exportDeepLink").ExportDeepLinkContext,
    ) => callback(context);
    ipcRenderer.on("export-context", listener);
    return () => ipcRenderer.removeListener("export-context", listener);
  },
});
