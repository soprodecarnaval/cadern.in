import { describe, expect, it } from "vitest";
import {
  ROUTE_PATTERNS,
  articlePath,
  newProjectPath,
  projectPath,
  projectSettingsPath,
  publicSongbookPath,
  scorePath,
  scoreRevisionPath,
  songbookPath,
  songbookScorePath,
} from "./routes";

describe("route patterns", () => {
  it("uses the canonical pt-BR paths", () => {
    expect(ROUTE_PATTERNS).toMatchObject({
      projects: "/projetos",
      newProject: "/projetos/novo",
      project: "/projetos/:slug",
      projectSettings: "/projetos/:slug/configuracoes",
      publicSongbook: "/projetos/:slug/cadernos/:songbookSlug",
      songbook: "/projetos/:slug/cadernos/:songbookSlug/gerenciar",
      songbookScore:
        "/projetos/:slug/cadernos/:songbookSlug/gerenciar/partituras/:scoreId",
      score: "/partituras/:scoreId",
      scoreRevision: "/partituras/:scoreId/versoes/:revisionId",
    });
  });
});

describe("route builders", () => {
  it("builds project routes", () => {
    expect(newProjectPath()).toBe("/projetos/novo");
    expect(projectPath("bloco-exemplo")).toBe("/projetos/bloco-exemplo");
    expect(projectSettingsPath("bloco-exemplo")).toBe(
      "/projetos/bloco-exemplo/configuracoes",
    );
  });

  it("builds songbook routes", () => {
    expect(publicSongbookPath("bloco-exemplo", "carnaval")).toBe(
      "/projetos/bloco-exemplo/cadernos/carnaval",
    );
    expect(songbookPath("bloco-exemplo", "carnaval")).toBe(
      "/projetos/bloco-exemplo/cadernos/carnaval/gerenciar",
    );
    expect(songbookScorePath("bloco-exemplo", "carnaval", "score-1")).toBe(
      "/projetos/bloco-exemplo/cadernos/carnaval/gerenciar/partituras/score-1",
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
    expect(projectPath("bloco exemplo")).toBe("/projetos/bloco%20exemplo");
    expect(scorePath("score/1")).toBe("/partituras/score%2F1");
    expect(publicSongbookPath("bloco", "carnaval 2026")).toBe(
      "/projetos/bloco/cadernos/carnaval%202026",
    );
  });
});
