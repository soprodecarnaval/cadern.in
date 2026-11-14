import { describe, expect, it } from "vitest";
import { initialsOf } from "./displayName";

describe("initialsOf", () => {
  it("takes the first and last names' initials", () => {
    expect(initialsOf({ displayName: "Ana Maria Silva", email: null })).toBe(
      "AS",
    );
  });

  it("takes one initial from a single name", () => {
    expect(initialsOf({ displayName: "ana", email: null })).toBe("A");
  });

  it("falls back to the email when there is no name", () => {
    expect(initialsOf({ displayName: "  ", email: "joao.souza@x.test" })).toBe(
      "JT",
    );
  });

  it("is a question mark with neither", () => {
    expect(initialsOf({ displayName: null, email: null })).toBe("?");
  });
});
