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
});
