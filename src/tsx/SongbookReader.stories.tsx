import type { Meta, StoryObj } from "@storybook/react";
import {
  fn,
  fireEvent,
  userEvent,
  within,
  expect,
  waitFor,
} from "@storybook/test";
import { Badge } from "react-bootstrap";
import { SongbookReader } from "./SongbookReader";
import {
  songbookFixture,
  songbookItems,
  type SongbookFixtureEntry,
} from "./storyFixtures";

// The reader remembers the chosen instrument in localStorage; stories start
// from the songbook's first instrument (Flauta) instead.
const INSTRUMENT_KEY = "cadernin:instrumento";

// The score opens from `?musica=<number>`. Canvases at least 900px wide (and
// wider than tall, with a mouse) show it in a modal over the index; narrower
// ones show the phone/tablet full-screen view.
const openSong = (n: number) => ({
  router: { initialEntries: [`/?musica=${n}`] },
});

const longSongbook: SongbookFixtureEntry[] = [
  "Aquecimento",
  ...[
    "Cidade Maravilhosa",
    "Mamãe Eu Quero",
    "Taj Mahal",
    "Me Dá um Dinheiro Aí, Me Dá, Me Dá, Me Dá (versão estendida do bloco)",
    "Sandália de Prata",
    "Allah-la-ô",
    "Índio Quer Apito",
    "Cabeleira do Zezé",
    "Máscara Negra",
    "Turma do Funil",
    "Pó de Mico",
    "Marcha do Remador",
  ].map((title) => ({ title })),
  "Cortejo pela Avenida Afonso Pena até a Praça da Estação",
  ...Array.from({ length: 12 }, (_, i) => ({ title: `Frevo nº ${i + 1}` })),
  "Dispersão",
  ...Array.from({ length: 12 }, (_, i) => ({ title: `Marchinha ${i + 1}` })),
  "Bis",
  ...Array.from({ length: 12 }, (_, i) => ({ title: `Samba ${i + 1}` })),
];

const meta = {
  title: "Components/SongbookReader",
  component: SongbookReader,
  parameters: { layout: "fullscreen" },
  beforeEach: () => {
    try {
      localStorage.removeItem(INSTRUMENT_KEY);
    } catch {
      // Storage blocked: the reader falls back to the first instrument anyway.
    }
  },
  args: {
    title: "Carnaval 2026",
    items: songbookItems(songbookFixture),
    actions: <a href="#detalhes">Detalhes, PDF e versões</a>,
    onDownloadPdf: fn(() => Promise.resolve()),
  },
} satisfies Meta<typeof SongbookReader>;
export default meta;
type Story = StoryObj<typeof meta>;

// Index ----------------------------------------------------------------------

export const Index: Story = {};

export const WithBadges: Story = {
  args: {
    badges: (
      <>
        <Badge bg="secondary">não publicado</Badge>
        <Badge bg="warning">versão antiga</Badge>
      </>
    ),
  },
};

export const ScoresBeforeFirstSection: Story = {
  args: {
    items: songbookItems([
      { title: "Cidade Maravilhosa" },
      { title: "Mamãe Eu Quero" },
      "Cortejo",
      { title: "Frevo Mulher" },
      { title: "Sandália de Prata" },
    ]),
  },
};

// What a songbook saved with a blank section looks like (e.g. "teste1" on
// staging): a heading with no name and a count of 0.
export const EmptyUntitledSection: Story = {
  args: {
    items: songbookItems([
      "",
      "1",
      { title: "Cidade Maravilhosa" },
      { title: "Mamãe Eu Quero" },
      { title: "Taj Mahal" },
      { title: "Frevo Mulher" },
    ]),
  },
};

export const LongSongbook: Story = {
  args: {
    title: "Bloco de Rua — Repertório Completo do Carnaval de Belo Horizonte",
    items: songbookItems(longSongbook),
  },
};

export const RemovedScores: Story = {
  args: {
    items: songbookItems([
      "Aquecimento",
      { title: "Cidade Maravilhosa" },
      { title: "Mamãe Eu Quero", deleted: true },
      { title: "Taj Mahal" },
      "Cortejo",
      { title: "Frevo Mulher", deleted: true },
      { title: "Sandália de Prata" },
    ]),
  },
};

export const EmptySongbook: Story = {
  args: { items: [] },
};

export const CollapsedSection: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: /Cortejo/ }),
    );
  },
};

// Sets the whole query at once: simulated keystrokes (userEvent.type) don't
// always reach React in embedded browsers.
const search = (canvasElement: HTMLElement, query: string) =>
  fireEvent.change(within(canvasElement).getByRole("searchbox"), {
    target: { value: query },
  });

// Search matches titles, composers and numbers; results show each song's
// section instead of grouping them under headings.
export const Searching: Story = {
  play: async ({ canvasElement }) => {
    await search(canvasElement, "prata");
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.queryByText("Cidade Maravilhosa")).toBeNull(),
    );
    await expect(canvas.getByText("Sandália de Prata")).toBeInTheDocument();
  },
};

export const NoSearchResults: Story = {
  play: async ({ canvasElement }) => {
    await search(canvasElement, "xote");
    await waitFor(() =>
      expect(
        within(canvasElement).getByText(/Nenhuma música encontrada/),
      ).toBeInTheDocument(),
    );
  },
};

// PDF ------------------------------------------------------------------------

export const PdfGenerating: Story = {
  args: { onDownloadPdf: fn(() => new Promise<void>(() => undefined)) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Baixar PDF/ }));
    await expect(args.onDownloadPdf).toHaveBeenCalledWith("flauta");
    await expect(canvas.getByText(/Gerando/)).toBeInTheDocument();
  },
};

export const PdfFailed: Story = {
  args: {
    onDownloadPdf: fn(() => Promise.reject(new Error("fixture failure"))),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Baixar PDF/ }));
    await waitFor(() => expect(canvas.getByRole("alert")).toBeInTheDocument());
  },
};

// Open score -----------------------------------------------------------------

export const ScoreOpen: Story = {
  parameters: openSong(3),
};

export const ScoreOpenTwoPages: Story = {
  parameters: openSong(4),
};

export const ScoreOpenMissingPart: Story = {
  args: {
    items: songbookItems([
      "Aquecimento",
      { title: "Cidade Maravilhosa" },
      { title: "Só Trompete", instruments: ["trompete"] },
      { title: "Taj Mahal" },
    ]),
  },
  parameters: openSong(2),
};
