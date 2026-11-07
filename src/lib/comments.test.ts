import { describe, expect, it } from "vitest";
import type { ReviewCommentDoc } from "../../types/docs";
import { commentThreads } from "./comments";
import type { WithId } from "./db";

const anchor = { partName: "Trompete", page: 1, x: 0.5, y: 0.5 };
const comment = (
  id: string,
  extra: Partial<ReviewCommentDoc> = {},
): WithId<ReviewCommentDoc> =>
  ({
    id,
    authorId: "u",
    authorName: "U",
    body: id,
    parentId: null,
    anchor: null,
    deletedAt: null,
    ...extra,
  }) as WithId<ReviewCommentDoc>;

describe("commentThreads", () => {
  it("groups replies under roots and numbers pinned roots in order", () => {
    const threads = commentThreads([
      comment("a", { anchor }),
      comment("b"),
      comment("a1", { parentId: "a" }),
      comment("c", { anchor }),
    ]);
    expect(
      threads.map((t) => [t.root.id, t.pinNumber, t.replies.map((r) => r.id)]),
    ).toEqual([
      ["a", 1, ["a1"]],
      ["b", null, []],
      ["c", 2, []],
    ]);
  });

  it("keeps a deleted root only while it has live replies, without a pin", () => {
    const deleted = { deletedAt: {} as ReviewCommentDoc["deletedAt"] };
    const threads = commentThreads([
      comment("a", { anchor, ...deleted }),
      comment("a1", { parentId: "a" }),
      comment("b", { anchor, ...deleted }),
      comment("c", { anchor }),
    ]);
    expect(threads.map((t) => [t.root.id, t.pinNumber])).toEqual([
      ["a", null],
      ["c", 1],
    ]);
  });
});
