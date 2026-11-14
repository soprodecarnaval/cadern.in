import type { User } from "firebase/auth";
import type { ExportResult } from "../../scripts/lib/exportScore";
import { uploadScore, type UploadProgress } from "../lib/uploadScore";
import { parseUploadedFiles, type ParsedScore } from "../lib/parseUploadedFiles";
import { resolveUploadTarget, type UploadTarget } from "../lib/uploadTarget";

export type ExportUploadProgress =
  | { kind: "exporting" }
  | { kind: "reading" }
  | { kind: "uploading"; progress?: UploadProgress };

interface Options {
  exportScore: () => Promise<ExportResult>;
  projectId: string;
  user: User;
  msczPath: string;
  onProgress: (status: ExportUploadProgress) => void;
  onParsed: (parsed: ParsedScore, target: UploadTarget) => void;
}

export async function exportAndUpload(options: Options): Promise<{
  scoreId: string;
  localStamped: boolean;
  directory: string;
}> {
  const { exportScore, projectId, user, msczPath, onProgress, onParsed } = options;
  if (!projectId) {
    throw new Error("Selecione um projeto.");
  }
  onProgress({ kind: "exporting" });
  const result = await exportScore();
  onProgress({ kind: "reading" });
  const raw = await window.api.readExportFolder(result.directory);
  const parsed = await parseUploadedFiles(
    raw.map((file) => new File([file.bytes], file.name)),
  );
  const target = await resolveUploadTarget(parsed, projectId);
  onParsed(parsed, target);
  onProgress({ kind: "uploading" });
  const identity = await uploadScore(parsed, projectId, target, user, {
    onProgress: (progress) => onProgress({ kind: "uploading", progress }),
    stampMscz: async (file, ids) => new File(
      [await window.api.stampMsczBytes(new Uint8Array(await file.arrayBuffer()), ids)],
      file.name,
      { type: file.type },
    ),
  });
  const localStamped = await window.api.stampMsczFile(msczPath, identity)
    .then(() => true)
    .catch(() => false);
  return { scoreId: identity.scoreId, localStamped, directory: result.directory };
}
