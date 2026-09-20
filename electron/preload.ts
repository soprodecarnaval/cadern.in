import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("api", {
  getMscorePath: () => ipcRenderer.invoke("mscore:get"),
  setMscorePath: (mscorePath: string) =>
    ipcRenderer.invoke("mscore:set", mscorePath),
  locateMscore: () => ipcRenderer.invoke("mscore:locate"),
  pickMscz: () => ipcRenderer.invoke("dialog:pickMscz"),
  pickExportDirectory: () =>
    ipcRenderer.invoke("dialog:pickExportDirectory"),
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
  runExport: (
    options: Omit<
      import("../scripts/lib/exportScore").RunExportOptions,
      "mscorePath"
    >,
  ) => ipcRenderer.invoke("score:runExport", options),
  openFolder: (folderPath: string) =>
    ipcRenderer.invoke("shell:openFolder", folderPath),
});
