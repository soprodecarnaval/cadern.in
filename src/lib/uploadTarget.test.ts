import { describe, expect, it } from "vitest";
import type { ScoreDoc } from "../../types/docs";
import type { WithId } from "./db";
import { resolveUploadTarget } from "./uploadTarget";

const score = (
  id: string,
  projectId: string,
  extra: Partial<ScoreDoc> = {},
): WithId<ScoreDoc> =>
  ({
    id,
    projectId,
    title: id,
    latestRevisionId: `${id}-latest`,
    ...extra,
  }) as WithId<ScoreDoc>;

const lookups = (scores: WithId<ScoreDoc>[], revisions: string[] = []) => ({
  getScore: (id: string) =>
    Promise.resolve(scores.find((s) => s.id === id) ?? null),
  getScoreForks: (id: string) =>
    Promise.resolve(
      scores.filter((s) => s.forkedFrom?.scoreId === id && !s.deletedAt),
    ),
  revisionExists: (_: string, revisionId: string) =>
    Promise.resolve(revisions.includes(revisionId)),
  projectTitle: (id: string) => Promise.resolve(`Projeto ${id}`),
});

const SOURCE = { scoreId: "cbh-eva", revisionId: "r1" };

describe("resolveUploadTarget", () => {
  it("makes a new version of this project's score, even if retitled", async () => {
    const target = await resolveUploadTarget(
      { title: "Outro nome", source: { scoreId: "gar-eva", revisionId: "r1" } },
      "gar",
      lookups([score("gar-eva", "gar")]),
    );
    expect(target).toMatchObject({ kind: "version", scoreId: "gar-eva" });
  });

  it("forks another project's score at the version the file came from", async () => {
    const target = await resolveUploadTarget(
      { title: "Eva", source: SOURCE },
      "gar",
      lookups([score("cbh-eva", "cbh")], ["r1"]),
    );
    expect(target).toEqual({
      kind: "fork",
      scoreId: "gar-eva",
      sourceTitle: "cbh-eva",
      sourceProjectTitle: "Projeto cbh",
      source: { scoreId: "cbh-eva", revisionId: "r1", projectId: "cbh" },
    });
  });

  it("falls back to the source's latest when that version is gone", async () => {
    const target = await resolveUploadTarget(
      { title: "Eva", source: SOURCE },
      "gar",
      lookups([score("cbh-eva", "cbh")]),
    );
    expect(target).toMatchObject({
      source: { revisionId: "cbh-eva-latest" },
    });
  });

  it("makes a new version of the fork already in the project", async () => {
    const fork = score("gar-minha-eva", "gar", {
      forkedFrom: { scoreId: "cbh-eva", revisionId: "r0", projectId: "cbh" },
    });
    const target = await resolveUploadTarget(
      { title: "Eva", source: SOURCE },
      "gar",
      lookups([score("cbh-eva", "cbh"), fork]),
    );
    expect(target).toMatchObject({ kind: "version", scoreId: "gar-minha-eva" });
  });

  it("gives a fork a free id when an unrelated score holds the title", async () => {
    const target = await resolveUploadTarget(
      { title: "Eva", source: SOURCE },
      "gar",
      lookups([score("cbh-eva", "cbh"), score("gar-eva", "gar")], ["r1"]),
    );
    expect(target).toMatchObject({ kind: "fork", scoreId: "gar-eva-2" });
  });

  it("uses the title's id when the file carries no identity", async () => {
    const existing = lookups([score("gar-eva", "gar")]);
    expect(
      await resolveUploadTarget({ title: "Eva" }, "gar", existing),
    ).toMatchObject({ kind: "version", scoreId: "gar-eva" });
    expect(
      await resolveUploadTarget({ title: "Novo" }, "gar", existing),
    ).toEqual({ kind: "new", scoreId: "gar-novo" });
  });

  it("treats an unknown identity like no identity", async () => {
    expect(
      await resolveUploadTarget({ title: "Eva", source: SOURCE }, "gar", lookups([])),
    ).toEqual({ kind: "new", scoreId: "gar-eva" });
  });

  it("never reuses a deleted score's id", async () => {
    const deleted = score("gar-eva", "gar", { deletedAt: {} as never });
    expect(
      await resolveUploadTarget({ title: "Eva" }, "gar", lookups([deleted])),
    ).toEqual({ kind: "new", scoreId: "gar-eva-2" });
    expect(
      await resolveUploadTarget(
        { title: "Eva", source: { scoreId: "gar-eva", revisionId: "r1" } },
        "gar",
        lookups([deleted]),
      ),
    ).toEqual({ kind: "new", scoreId: "gar-eva-2" });
  });
});
