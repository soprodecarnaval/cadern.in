import { File } from "node:buffer";
import type { User } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportAndUpload, type ExportUploadProgress } from "./exportAndUpload";

const mocks = vi.hoisted(() => ({
  parse: vi.fn(), validate: vi.fn(() => []), resolve: vi.fn(), upload: vi.fn(),
}));
vi.mock("../lib/parseUploadedFiles", () => ({ parseUploadedFiles: mocks.parse, validateParsedScore: mocks.validate }));
vi.mock("../lib/uploadTarget", () => ({ resolveUploadTarget: mocks.resolve }));
vi.mock("../lib/uploadScore", () => ({ uploadScore: mocks.upload }));

const readExportFolder = vi.fn();
const stampMsczFile = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("File", File);
  vi.stubGlobal("window", { api: {
    readExportFolder: readExportFolder.mockResolvedValue([{ name: "Score.mscz", bytes: new Uint8Array() }]),
    stampMsczFile: stampMsczFile.mockResolvedValue(undefined),
  } });
  mocks.parse.mockResolvedValue({ title: "Score", parts: [], warnings: [] });
  mocks.resolve.mockResolvedValue({ kind: "new", scoreId: "score" });
  mocks.upload.mockResolvedValue({ scoreId: "score", revisionId: "rev" });
});

afterEach(() => { vi.unstubAllGlobals(); });

const options = () => ({
  exportScore: vi.fn().mockResolvedValue({ directory: "/temp/export", files: ["Score.mscz"] }),
  projectId: "chosen-project",
  user: { uid: "user" } as User,
  msczPath: "/original.mscz",
  onProgress: vi.fn<(status: ExportUploadProgress) => void>(),
  onParsed: vi.fn(),
});

describe("combined export and upload", () => {
  it("assigns the SVG MIME type to exported score pages", async () => {
    readExportFolder.mockResolvedValueOnce([
      { name: "parts/Score-sax tenor-1.svg", bytes: new Uint8Array() },
      { name: "Score.mscz", bytes: new Uint8Array() },
    ]);

    await exportAndUpload(options());

    const files = mocks.parse.mock.calls[0][0] as File[];
    expect(files[0].name).toBe("parts/Score-sax tenor-1.svg");
    expect(files[0].type).toBe("image/svg+xml");
    expect(files[1].type).toBe("");
  });

  it("exports, then uploads to the selected project with no second action", async () => {
    const args = options();
    const result = await exportAndUpload(args);
    expect(args.exportScore).toHaveBeenCalledOnce();
    expect(args.exportScore.mock.invocationCallOrder[0]).toBeLessThan(readExportFolder.mock.invocationCallOrder[0]);
    expect(readExportFolder.mock.invocationCallOrder[0]).toBeLessThan(mocks.upload.mock.invocationCallOrder[0]);
    expect(readExportFolder).toHaveBeenCalledWith("/temp/export");
    expect(mocks.resolve).toHaveBeenCalledWith(expect.objectContaining({ title: "Score" }), "chosen-project");
    expect(mocks.upload).toHaveBeenCalledWith(expect.anything(), "chosen-project", expect.anything(), args.user, expect.anything());
    expect(args.onProgress.mock.calls.map(([s]) => s.kind)).toEqual(["exporting", "reading", "uploading"]);
    expect(stampMsczFile).toHaveBeenCalledWith("/original.mscz", { scoreId: "score", revisionId: "rev" });
    expect(result).toMatchObject({ scoreId: "score", localStamped: true });
  });

  it("requires a project before exporting", async () => {
    const args = { ...options(), projectId: "" };
    await expect(exportAndUpload(args)).rejects.toThrow();
    expect(args.exportScore).not.toHaveBeenCalled();
  });

  it("does not upload when export fails", async () => {
    const args = options();
    args.exportScore.mockRejectedValue(new Error("export failed"));
    await expect(exportAndUpload(args)).rejects.toThrow("export failed");
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("propagates upload failure without stamping the original", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("upload failed"));
    await expect(exportAndUpload(options())).rejects.toThrow("upload failed");
    expect(stampMsczFile).not.toHaveBeenCalled();
  });

  it("stops before upload when reading exported files fails", async () => {
    readExportFolder.mockRejectedValueOnce(new Error("read failed"));
    await expect(exportAndUpload(options())).rejects.toThrow("read failed");
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("stops before upload when destination resolution fails", async () => {
    mocks.resolve.mockRejectedValueOnce(new Error("project unavailable"));
    await expect(exportAndUpload(options())).rejects.toThrow("project unavailable");
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("reports local stamping failure after successful upload", async () => {
    stampMsczFile.mockRejectedValueOnce(new Error("locked"));
    await expect(exportAndUpload(options())).resolves.toMatchObject({ localStamped: false });
  });
});
