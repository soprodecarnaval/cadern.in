import { describe, expect, it } from "vitest";
import { matchCoverFiles } from "./songbookCovers";

const file = (name: string, type = "image/png") => new File(["x"], name, { type });

describe("matchCoverFiles", () => {
  it("matches instruments by filename and reports the rest", () => {
    const { matched, unmatched } = matchCoverFiles([
      file("capa-trompete.png"),
      file("capa_trombone.jpg", "image/jpeg"),
      file("capa-desconhecida.png"),
      file("capa-flauta.pdf", "application/pdf"),
    ]);
    expect([...matched.keys()]).toEqual(["trompete", "trombone"]);
    expect(unmatched).toEqual(["capa-desconhecida.png", "capa-flauta.pdf"]);
  });

  it("keeps the last file for an instrument", () => {
    const later = file("trompete-v2.png");
    const { matched } = matchCoverFiles([file("trompete.png"), later]);
    expect(matched.get("trompete")).toBe(later);
  });
});
