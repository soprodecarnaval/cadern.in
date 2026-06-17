import { contextBridge } from "electron";

// IPC surface is filled in by later milestones (mscore, export, upload).
contextBridge.exposeInMainWorld("api", {});
