import { describe, expect, it } from "vitest";
import {
  buildPartBasenames,
  collectPartFiles,
  safeFilename,
} from "./exportScore";

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

describe("collectPartFiles", () => {
  it("orders pages numerically, not lexically", () => {
    const files = [
      "Marcha-trompete-10.svg",
      "Marcha-trompete-2.svg",
      "Marcha-trompete-1.svg",
      "Marcha-trompete.midi",
    ];

    expect(collectPartFiles(files, "Marcha-trompete")).toEqual({
      svg: [
        "Marcha-trompete-1.svg",
        "Marcha-trompete-2.svg",
        "Marcha-trompete-10.svg",
      ],
      midi: "Marcha-trompete.midi",
    });
  });

  it("accepts an unsuffixed single page", () => {
    expect(collectPartFiles(["Marcha-flauta.svg"], "Marcha-flauta").svg).toEqual([
      "Marcha-flauta.svg",
    ]);
  });

  it("does not claim pages belonging to a longer basename", () => {
    // -a and -b suffixes mean one basename can prefix another.
    const files = ["Marcha-tuba-1.svg", "Marcha-tuba eb-1.svg"];

    expect(collectPartFiles(files, "Marcha-tuba").svg).toEqual([
      "Marcha-tuba-1.svg",
    ]);
  });
});
