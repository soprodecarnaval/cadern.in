import { describe, expect, it } from "vitest";
import { newRevisionId, revisionSlug, revisionTimestamp } from "./revisionId";

const DATE = new Date("2026-10-08T14:05:09.123Z");

describe("revisionTimestamp", () => {
  it("formats as YYYYMMDDTHHmmss in UTC", () => {
    expect(revisionTimestamp(DATE)).toBe("20261008T140509");
  });
});

describe("revisionSlug", () => {
  it("joins the slugified title and the timestamp", () => {
    expect(revisionSlug("Olha pro Céu", DATE)).toBe(
      "olha-pro-ceu-20261008T140509",
    );
  });
});

describe("newRevisionId", () => {
  it("appends 4 base-36 characters", () => {
    expect(newRevisionId("x-20261008T140509", () => 0.5)).toBe(
      "x-20261008T140509-iiii",
    );
    expect(newRevisionId("x")).toMatch(/^x-[0-9a-z]{4}$/);
  });
});
