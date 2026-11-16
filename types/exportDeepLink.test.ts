import { describe, expect, it } from "vitest";
import {
  buildExportDeepLink,
  findExportDeepLinkArg,
  parseExportDeepLink,
} from "./exportDeepLink";

describe("buildExportDeepLink / parseExportDeepLink", () => {
  it("round-trips a project-only link", () => {
    const link = buildExportDeepLink({ projectId: "bloco-exemplo" });
    expect(parseExportDeepLink(link)).toEqual({
      projectId: "bloco-exemplo",
      scoreId: undefined,
      expectedScoreRevisionId: undefined,
      songbookId: undefined,
      expectedSongbookRevisionId: undefined,
    });
  });

  it("round-trips a full songbook-scoped link", () => {
    const context = {
      projectId: "bloco-exemplo",
      scoreId: "bloco-exemplo-mineirinho",
      expectedScoreRevisionId: "rev-2",
      songbookId: "bloco-exemplo~carnaval",
      expectedSongbookRevisionId: "book-rev-3",
    };
    expect(parseExportDeepLink(buildExportDeepLink(context))).toEqual(
      context,
    );
  });

  it("rejects a different protocol, a malformed URL, or a missing projectId", () => {
    expect(parseExportDeepLink("https://example.com?projectId=x")).toBeNull();
    expect(parseExportDeepLink("not a url")).toBeNull();
    expect(parseExportDeepLink("cadernin-export://upload")).toBeNull();
  });
});

describe("findExportDeepLinkArg", () => {
  it("picks the deep link out of a longer argv list", () => {
    expect(
      findExportDeepLinkArg([
        "/path/to/exe",
        "--some-flag",
        "cadernin-export://upload?projectId=x",
      ]),
    ).toBe("cadernin-export://upload?projectId=x");
  });

  it("returns undefined when there is none", () => {
    expect(findExportDeepLinkArg(["/path/to/exe", "--some-flag"])).toBeUndefined();
  });
});
