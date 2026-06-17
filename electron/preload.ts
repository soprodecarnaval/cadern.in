import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  getMscorePath: () => ipcRenderer.invoke("mscore:get"),
  setMscorePath: (mscorePath: string) =>
    ipcRenderer.invoke("mscore:set", mscorePath),
  locateMscore: () => ipcRenderer.invoke("mscore:locate"),
  pickMscz: () => ipcRenderer.invoke("dialog:pickMscz"),
  listParts: (msczPath: string) =>
    ipcRenderer.invoke("score:listParts", msczPath),
});
