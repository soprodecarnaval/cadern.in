// Bridge exposed by electron/preload.ts via contextBridge.
// Expanded by later milestones (mscore, export, upload).
export type ExportApi = Record<string, never>;

declare global {
  interface Window {
    api: ExportApi;
  }
}
