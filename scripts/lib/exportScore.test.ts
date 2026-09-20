import { describe, expect, it } from "vitest";
import { buildPartBasenames, safeFilename } from "./exportScore";

describe("exportScore", () => {
  it("preserves Unicode while replacing unsafe filename characters", () => {
    expect(safeFilename('Olha pro Céu: "Prática"')).toBe(
      "Olha pro Céu- -Prática-",
    );
  });

  it("gives duplicate instruments stable non-numeric suffixes", () => {
    const names = buildPartBasenames("Marcha", [
      { id: "10", name: "Trumpet 1", scoreIndex: 0, instrument: "trompete" },
      { id: "20", name: "Trombone", scoreIndex: 1, instrument: "trombone" },
      { id: "30", name: "Trumpet 2", scoreIndex: 2, instrument: "trompete" },
    ]);

    expect(names.get("10")).toBe("Marcha-trompete-a");
    expect(names.get("20")).toBe("Marcha-trombone");
    expect(names.get("30")).toBe("Marcha-trompete-b");
  });
});
