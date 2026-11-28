import { pinnedVersionItems } from "../../../../../.storybook/fixtures/components";
import { availableScoreDoc, score } from "../../../../../.storybook/fixtures/screens";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent, within, waitFor } from "@storybook/test";
import { SongbookManagePageView } from "./SongbookManagePageView";
import { SongbookReader } from "../../../components/songbooks/reader/SongbookReader";
import {
  bookRevision,
  generate,
  services,
  songbook,
  songbookComponents,
  user,
} from "../../../../../.storybook/fixtures/screens";
const meta = {
  title: "Screens/SongbookManagePage",
  component: SongbookManagePageView,
  parameters: {
    route: "/bloco-exemplo/carnaval/gerenciar?detalhes",
    routePath: "/:slug/:songbookSlug/gerenciar",
  },
  args: {
    services: { ...services, generateSongbookPdfs: generate },
    currentUser: user,
    role: "owner",
    components: songbookComponents,
  },
} satisfies Meta<typeof SongbookManagePageView>;
export default meta;
type Story = StoryObj<typeof SongbookManagePageView>;

export const OwnerDetails: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: "Editar" })).toBeVisible();
    // Duplicar, Editar, Publicar/Despublicar, in that order; no Enviar partitura.
    const actions = canvas.getByRole("button", { name: "Editar" }).parentElement!;
    await expect([...actions.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Duplicar", "Editar", "Despublicar"]);
    await expect(canvas.queryByRole("link", { name: "Enviar partitura" })).toBeNull();
    // Print settings live in Editar (037); Gerenciar keeps its links.
    await expect(canvas.queryByRole("button", { name: "Configurações de impressão" })).toBeNull();
    await expect(canvas.getByRole("link", { name: "abrir caderninho" })).toBeVisible();
  },
};
export const DirectEdit: Story = {
  parameters: { route: "/bloco-exemplo/carnaval/gerenciar?detalhes&editar" },
  play: async ({ canvasElement }) => {
    // The toolbar's save button opens "Salvar versão" with the note.
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Salvar versão" }));
    const dialog = within(await screen.findByRole("dialog"));
    // Once it has faded in.
    await waitFor(() =>
      expect(dialog.getByRole("textbox", { name: "O que mudou nesta versão? (opcional)" })).toBeVisible());
    await expect(dialog.getByRole("button", { name: "Salvar versão" })).toBeEnabled();
  },
};
export const EditorPrintSettings: Story = {
  parameters: { route: "/bloco-exemplo/carnaval/gerenciar?detalhes&editar" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The button takes the links' place (037).
    const button = await canvas.findByRole("button", { name: "Configurações de impressão" });
    await expect(canvas.queryByRole("link", { name: "abrir caderninho" })).toBeNull();
    await expect(canvas.queryByRole("link", { name: "caderninhos do projeto" })).toBeNull();
    await userEvent.click(button);
    const dialog = within(await screen.findByRole("dialog", { name: "Configurações de impressão" }));
    await expect(dialog.queryByRole("button", { name: /Gerar/ })).toBeNull();
    await expect(dialog.getByRole("button", { name: "Salvar" })).toBeDisabled();
    await userEvent.click(dialog.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};
export const EditorRoleNoPrintSettings: Story = {
  // Editors may open ?editar but get the details page, without print settings.
  args: { role: "editor" },
  parameters: { route: "/bloco-exemplo/carnaval/gerenciar?detalhes&editar" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/versão #/)).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Configurações de impressão" })).toBeNull();
  },
};
export const ReaderEditButton: Story = {
  // The reader the caderninho's name opens: Editar next to Gerenciar.
  args: { components: { ...songbookComponents, SongbookReader } },
  parameters: { route: "/bloco-exemplo/carnaval/gerenciar" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("link", { name: "Editar" })).toHaveAttribute("href", "/bloco-exemplo/carnaval/gerenciar?detalhes&editar");
    await expect(canvas.getByRole("link", { name: "Gerenciar" })).toBeVisible();
    // Right after the title.
    await expect(canvas.getByRole("heading", { name: songbook.title }).nextElementSibling).toBe(canvas.getByRole("link", { name: "Editar" }));
  },
};
export const ReaderReviewerNoEdit: Story = {
  args: { role: "reviewer", components: { ...songbookComponents, SongbookReader } },
  parameters: { route: "/bloco-exemplo/carnaval/gerenciar" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("link", { name: "Gerenciar" })).toBeVisible();
    await expect(canvas.queryByRole("link", { name: "Editar" })).toBeNull();
  },
};
export const AccessDenied: Story = {
  args: { currentUser: null, role: undefined },
};
export const ReviewerDetails: Story = {
  args: { role: "reviewer" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Only Duplicar: reviewers may neither edit nor publish.
    await expect(await canvas.findByRole("button", { name: /Duplicar/ })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Editar" })).toBeNull();
    await expect(canvas.queryByRole("button", { name: /Publicar|Despublicar/ })).toBeNull();
  },
};
export const Loading: Story = { args: { role: "loading" } };
export const NotFound: Story = {
  args: {
    services: {
      ...services,
      generateSongbookPdfs: generate,
      getSongbook: () => Promise.resolve(null),
    },
  },
};
export const Unpublished: Story = {
  args: {
    services: {
      ...services,
      generateSongbookPdfs: generate,
      getSongbook: () => Promise.resolve({ ...songbook, isPublished: false }),
    },
  },
};
export const OlderRevision: Story = {
  args: {
    services: {
      ...services,
      generateSongbookPdfs: generate,
      getSongbookRevision: () =>
        Promise.resolve({
          ...bookRevision,
          id: "book-revision-1",
          revisionNumber: 1,
        }),
    },
  },
};
export const Empty: Story = {
  args: {
    services: {
      ...services,
      generateSongbookPdfs: generate,
      getSongbookRevision: () =>
        Promise.resolve({ ...bookRevision, entries: [], pins: {} }),
    },
  },
};
export const Editor: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Editar" }),
    );
    await waitFor(async () => {
      await expect(
        await canvas.findByRole("button", { name: "Salvar versão" }),
      ).toBeVisible();
    });
  },
};

export const NewerScoreRevision: Story = {
  args: {
    services: {
      ...services,
      generateSongbookPdfs: generate,
      loadPinnedScores: () =>
        Promise.resolve(
          new Map([
            [
              score.id,
              { score, deleted: false, latestRevisionId: "revision-3" },
            ],
          ]),
        ),
    },
  },
};
export const DeletedScore: Story = {
  args: {
    services: {
      ...services,
      generateSongbookPdfs: generate,
      loadPinnedScores: () =>
        Promise.resolve(
          new Map([
            [
              score.id,
              {
                score,
                deleted: true,
                latestRevisionId: score.latestRevision.id,
              },
            ],
          ]),
        ),
    },
  },
};

export const EditorAddScore: Story = {
  play: async (context) => {
    await Editor.play!(context);
    const canvas = within(context.canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Adicionar Marchinha do bloco",
      }),
    );
    await waitFor(async () => {
      await expect(
        await canvas.findByRole("button", {
          name: "Remover Marchinha do bloco",
        }),
      ).toBeVisible();
    });
  },
};

// Saving a new version from the editor keeps the songbook's covers: they
// belong to each version, and used to be left behind.
const coveredRevision = {
  ...bookRevision,
  covers: { trompete: { path: "capas/trompete.png", url: "#capa-trompete" } },
};
const saveRevision = fn(() => Promise.resolve("book-revision-3"));
export const EditorSaveKeepsCovers: Story = {
  parameters: { route: "/bloco-exemplo/carnaval/gerenciar?detalhes&editar" },
  args: {
    services: {
      ...services,
      generateSongbookPdfs: generate,
      getSongbookRevision: () => Promise.resolve(coveredRevision),
      createSongbookRevision: saveRevision,
    },
  },
  play: async ({ canvasElement }) => {
    saveRevision.mockClear();
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Salvar versão" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Salvar versão" }));
    await waitFor(() => expect(saveRevision).toHaveBeenCalled());
    // Its second argument is the new version's content.
    const [, content] = saveRevision.mock.calls[0] as unknown[];
    await expect(content).toMatchObject({ covers: coveredRevision.covers });
  },
};

// More scores than one page of Partituras (10): the editor shows Montar's
// pages; moving to the second shows the rest.
const manyScores: (typeof availableScoreDoc)[] = Array.from({ length: 12 }, (_, i) => ({
  ...availableScoreDoc,
  id: `fixture-score-many-${i + 1}`,
  // Zero-padded, so sorting by title keeps 11 and 12 on the second page.
  title: `Música ${String(i + 1).padStart(2, "0")}`,
  cachedMetadata: availableScoreDoc.cachedMetadata && {
    ...availableScoreDoc.cachedMetadata,
    title: `Música ${String(i + 1).padStart(2, "0")}`,
  },
}));
export const EditorPagedScores: Story = {
  parameters: { route: "/bloco-exemplo/carnaval/gerenciar?detalhes&editar" },
  args: {
    services: {
      ...services,
      generateSongbookPdfs: generate,
      getAllScores: () => Promise.resolve(manyScores),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Música 01")).toBeVisible();
    await expect(canvas.queryByText("Música 11")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByText("Next"));
    await expect(await canvas.findByText("Música 11")).toBeVisible();
  },
};

const labelScores = pinnedVersionItems.flatMap((item) =>
  item.type === "score" ? [item] : [],
);
const labelServices = {
  ...services,
  generateSongbookPdfs: generate,
  loadPinnedScores: () =>
    Promise.resolve(
      new Map(
        labelScores.map((item) => [
          item.score.id,
          {
            score: item.score,
            deleted: !!item.deleted,
            latestRevisionId: item.latestRevisionId!,
          },
        ]),
      ),
    ),
  getSongbookRevision: () =>
    Promise.resolve({
      ...bookRevision,
      entries: labelScores.map((item, order) => ({
        type: "score" as const,
        scoreId: item.score.id,
        order,
        index: item.index,
      })),
      pins: Object.fromEntries(
        labelScores.map((item) => [item.score.id, item.score.latestRevision.id]),
      ),
    }),
};
export const PinnedVersionLabels: Story = {
  args: { services: labelServices },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("v3")).toBeVisible();
    await expect(canvas.getByText("bloco-vizinho/v2")).toBeVisible();
    await expect(canvas.getByText("projeto-externo/v4")).toBeVisible();
    await expect(canvas.getByText("v1")).toBeVisible();
    await expect(canvas.getByText("Carinhoso").tagName).toBe("S");
    await expect(canvas.queryByText("bloco-exemplo/v3")).toBeNull();
    await expect(canvas.queryByText("bloco-vizinho/v5")).toBeNull();
  },
};
export const EditorPinnedVersionLabels: Story = {
  args: { services: labelServices },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Editar" }));
    // The editor's cards show the arrangement, as on Montar, not the pinned
    // version (the songbook's details list it).
    await expect(await canvas.findByText("Ary Barroso", { exact: false })).toBeVisible();
    await expect(canvas.queryByText(/bloco-vizinho\/v2/)).toBeNull();
    await expect(canvas.queryByText("v3")).toBeNull();
  },
};
