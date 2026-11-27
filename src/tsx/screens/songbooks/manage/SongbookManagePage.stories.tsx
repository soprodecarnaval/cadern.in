import { pinnedVersionItems } from "../../../../../.storybook/fixtures/components";
import { score } from "../../../../../.storybook/fixtures/screens";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, fn, userEvent, within, waitFor } from "@storybook/test";
import { SongbookManagePageView } from "./SongbookManagePageView";
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

export const OwnerDetails: Story = {};
export const ForkOlderRevision: Story = {
  parameters: { route: "/bloco-exemplo/carnaval/gerenciar?detalhes&versao=older" },
  args: {
    role: "admin",
    services: {
      ...services,
      generateSongbookPdfs: generate,
      getSongbook: (_project, slug) => Promise.resolve(slug === songbook.slug ? songbook : null),
      getSongbookRevision: () => Promise.resolve({ ...bookRevision, id: "older" }),
      createSongbook: fn(services.createSongbook),
    },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Criar cópia desta versão" }));
    const form = within(canvas.getByRole("form", { name: "Criar cópia do caderninho" }));
    const title = form.getByRole("textbox", { name: "Título do novo caderninho" });
    await fireEvent.change(title, { target: { value: "Cópia de Carnaval" } });
    await userEvent.click(form.getByRole("button", { name: "Criar cópia" }));
    await waitFor(() => expect(args.services.createSongbook).toHaveBeenCalledWith({
      projectId: songbook.projectId,
      createdBy: user.uid,
      slug: "copia-de-carnaval",
      title: "Cópia de Carnaval",
      content: { entries: bookRevision.entries, pins: bookRevision.pins, covers: {} },
    }));
  },
};
export const EditorCannotFork: Story = {
  args: { role: "editor" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: songbook.title });
    await expect(canvas.queryByRole("button", { name: "Criar cópia desta versão" })).not.toBeInTheDocument();
  },
};
export const DirectEdit: Story = {
  parameters: { route: "/bloco-exemplo/carnaval/gerenciar?detalhes&editar" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("button", { name: "Salvar versão" })).toBeVisible();
  },
};
export const AccessDenied: Story = {
  args: { currentUser: null, role: undefined },
};
export const ReviewerDetails: Story = { args: { role: "reviewer" } };
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
    await expect(await canvas.findByText(/bloco-vizinho\/v2/)).toBeVisible();
    await expect(canvas.getByText("v3").closest(".score-card-meta")).toHaveTextContent("v3 · Ary Barroso");
    await expect(canvas.queryByText(/bloco-vizinho\/v5/)).toBeNull();
  },
};
