import { describe, expect, it } from "vitest";
import { FirebaseError } from "firebase/app";
import { describeAuthError } from "./authMessages";

describe("describeAuthError", () => {
  it("does not distinguish missing accounts from incorrect credentials", () => {
    expect(describeAuthError(new FirebaseError("auth/user-not-found", "secret")))
      .toBe(describeAuthError(new FirebaseError("auth/wrong-password", "secret")));
  });

  it("translates common actionable errors", () => {
    expect(describeAuthError(new FirebaseError("auth/network-request-failed", "secret"))).toContain("internet");
    expect(describeAuthError(new FirebaseError("auth/weak-password", "secret"))).toContain("senha");
  });

  it("does not expose unknown error details", () => {
    for (const error of [new FirebaseError("auth/unknown-code", "secret"), new Error("secret")]) {
      expect(describeAuthError(error)).toBe("Não foi possível concluir. Tente novamente.");
    }
  });
});
