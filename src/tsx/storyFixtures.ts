import type { Instrument } from "../../types/instrument";
import type {
  NumberedSongbookItemViewModel,
  ScoreViewModel,
  PartViewModel,
} from "../../types/viewModels";

export const part: PartViewModel = {
  name: "Flauta",
  instrument: "flauta",
  midi: "#fixture-midi",
  svg: [
    "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="180"><rect width="400" height="180" fill="white"/><text x="20" y="80">Partitura de exemplo — Flauta</text></svg>',
      ),
  ],
};
export const score: ScoreViewModel = {
  id: "fixture-score",
  title: "Carnaval em Belo Horizonte",
  composer: "Compositor de exemplo",
  sub: "Arranjo para bloco",
  tags: ["carnaval", "samba"],
  projectId: "fixture-project",
  projectTitle: "Bloco de exemplo",
  latestRevision: {
    id: "fixture-revision",
    revisionNumber: 1,
    uploadedBy: "fixture-user",
    uploadedAt: {
      seconds: 0,
      nanoseconds: 0,
    } as ScoreViewModel["latestRevision"]["uploadedAt"],
    mscz: "",
    metajson: "",
    midi: "",
    parts: [part],
    notes: "",
  },
};
export const noop = () => undefined;

// Songbook reader -----------------------------------------------------------

// A landscape score page drawn locally: title, five staves and a few notes.
const sheetSvg = (title: string, partName: string, page: number) => {
  const staves = [0, 1, 2, 3, 4]
    .map((s) => {
      const y = 130 + s * 95;
      const lines = [0, 1, 2, 3, 4]
        .map(
          (l) =>
            `<line x1="60" x2="1040" y1="${y + l * 10}" y2="${y + l * 10}" stroke="#222" stroke-width="1"/>`,
        )
        .join("");
      const notes = Array.from({ length: 14 }, (_, n) => {
        const x = 110 + n * 66;
        const ny = y + ((n * 7 + s * 3) % 9) * 5;
        return `<ellipse cx="${x}" cy="${ny}" rx="6" ry="4.5" fill="#222"/><line x1="${x + 6}" x2="${x + 6}" y1="${ny}" y2="${ny - 30}" stroke="#222"/>`;
      }).join("");
      return lines + notes;
    })
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="620" viewBox="0 0 1100 620">` +
    `<rect width="1100" height="620" fill="white"/>` +
    `<text x="550" y="60" font-family="serif" font-size="30" text-anchor="middle">${title}</text>` +
    `<text x="60" y="100" font-family="serif" font-size="16">${partName}</text>` +
    `<text x="1040" y="600" font-family="serif" font-size="14" text-anchor="end">${page}</text>` +
    staves +
    `</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
};

const partLabel = (i: Instrument) => i.charAt(0).toUpperCase() + i.slice(1);

export type SongbookFixtureEntry =
  | string
  | {
      title: string;
      composer?: string;
      // Defaults to flauta, sax alto and trompete.
      instruments?: Instrument[];
      pages?: number;
      deleted?: boolean;
    };

/**
 * Builds reader items from a compact list: a string starts a section, an
 * object is a score. Scores are numbered in order, as a saved songbook is.
 */
export function songbookItems(
  entries: SongbookFixtureEntry[],
): NumberedSongbookItemViewModel[] {
  let index = 0;
  return entries.map((entry) => {
    if (typeof entry === "string") {
      return { type: "section", title: entry };
    }
    index += 1;
    const instruments = entry.instruments ?? ["flauta", "sax alto", "trompete"];
    const parts: PartViewModel[] = instruments.map((instrument) => ({
      name: partLabel(instrument),
      instrument,
      midi: "#fixture-midi",
      svg: Array.from({ length: entry.pages ?? 1 }, (_, p) =>
        sheetSvg(entry.title, partLabel(instrument), p + 1),
      ),
    }));
    return {
      type: "score",
      index,
      deleted: entry.deleted,
      score: {
        ...score,
        id: `fixture-score-${index}`,
        title: entry.title,
        composer: entry.composer ?? "Compositor de exemplo",
        latestRevision: { ...score.latestRevision, parts },
      },
    };
  });
}

export const songbookFixture: SongbookFixtureEntry[] = [
  "Aquecimento",
  { title: "Cidade Maravilhosa", composer: "André Filho" },
  { title: "Mamãe Eu Quero", composer: "Jararaca e Vicente Paiva" },
  { title: "Taj Mahal", composer: "Jorge Ben Jor" },
  "Cortejo",
  { title: "Frevo Mulher", composer: "Zé Ramalho", pages: 2 },
  { title: "Sandália de Prata", composer: "Alcyr Pires Vermelho" },
  { title: "Me Dá um Dinheiro Aí", composer: "Ivan Ferreira" },
  { title: "Bloco do Prazer", composer: "Moraes Moreira" },
  "Dispersão",
  { title: "Ó Abre Alas", composer: "Chiquinha Gonzaga" },
  { title: "Bandeira Branca", composer: "Max Nunes e Laércio Alves" },
];
