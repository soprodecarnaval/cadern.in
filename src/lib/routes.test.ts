import { describe, expect, it } from "vitest";
import {
  ROUTE_PATTERNS,
  articlePath,
  isReservedProjectSlug,
  isReservedSongbookSlug,
  isYearOnlySlug,
  newProjectPath,
  projectPath,
  projectSettingsPath,
  publicSongbookPath,
  scorePath,
  scoreRevisionPath,
  songbookDetailsPath,
  songbookPath,
  songbookScorePath,
} from "./routes";

describe("route patterns", () => {
  it("uses the canonical GitHub-style paths", () => {
    expect(ROUTE_PATTERNS).toMatchObject({
      projects: "/projetos",
      newProject: "/projetos/novo",
      project: "/:slug",
      projectSettings: "/:slug/config",
      publicSongbook: "/:slug/:songbookSlug",
      songbook: "/:slug/:songbookSlug/gerenciar",
      songbookScore:
        "/:slug/:songbookSlug/gerenciar/partituras/:scoreId",
      score: "/partituras/:scoreId",
      scoreRevision: "/partituras/:scoreId/versoes/:revisionId",
    });
  });
});

describe("route builders", () => {
  it("builds project routes", () => {
    expect(newProjectPath()).toBe("/projetos/novo");
    expect(projectPath("bloco-exemplo")).toBe("/bloco-exemplo");
    expect(projectSettingsPath("bloco-exemplo")).toBe(
      "/bloco-exemplo/config",
    );
  });

  it("builds songbook routes", () => {
    expect(publicSongbookPath("bloco-exemplo", "carnaval")).toBe(
      "/bloco-exemplo/carnaval",
    );
    expect(songbookPath("bloco-exemplo", "carnaval")).toBe(
      "/bloco-exemplo/carnaval/gerenciar",
    );
    expect(songbookDetailsPath("bloco-exemplo", "carnaval")).toBe(
      "/bloco-exemplo/carnaval/gerenciar?detalhes",
    );
    expect(songbookScorePath("bloco-exemplo", "carnaval", "score-1")).toBe(
      "/bloco-exemplo/carnaval/gerenciar/partituras/score-1",
    );
  });

  it("builds score and article routes", () => {
    expect(scorePath("score-1")).toBe("/partituras/score-1");
    expect(scoreRevisionPath("score-1", "revision-1")).toBe(
      "/partituras/score-1/versoes/revision-1",
    );
    expect(articlePath("do-xerox-ao-codigo-aberto")).toBe(
      "/artigos/do-xerox-ao-codigo-aberto",
    );
  });

  it("encodes identifiers without changing slashes in the path", () => {
    expect(projectPath("bloco exemplo")).toBe("/bloco%20exemplo");
    expect(scorePath("score/1")).toBe("/partituras/score%2F1");
    expect(publicSongbookPath("bloco", "carnaval 2026")).toBe(
      "/bloco/carnaval%202026",
    );
  });
});

describe("reserved slugs", () => {
  it("reserves static, app and legacy top-level names", () => {
    for (const slug of [
      "projetos",
      "partituras",
      "artigos",
      "montar",
      "biblioteca",
      "plugin",
      "assets",
      "browser-score",
      "projects",
      "project",
      "score",
    ]) {
      expect(isReservedProjectSlug(slug)).toBe(true);
    }
    expect(isReservedProjectSlug("bloco-exemplo")).toBe(false);
  });

  it("reserves every year-only project slug", () => {
    expect(isYearOnlySlug("2026")).toBe(true);
    expect(isReservedProjectSlug("2026")).toBe(true);
    expect(isReservedProjectSlug("20260")).toBe(false);
  });

  it("reserves config and enviar as songbook slugs", () => {
    expect(isReservedSongbookSlug("config")).toBe(true);
    expect(isReservedSongbookSlug("enviar")).toBe(true);
    expect(isReservedSongbookSlug("exportador")).toBe(true);
    expect(isReservedSongbookSlug("carnaval")).toBe(false);
  });
});
