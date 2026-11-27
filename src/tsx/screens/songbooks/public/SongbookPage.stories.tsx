import { pinnedVersionItems } from "../../../../../.storybook/fixtures/components";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { SongbookReader } from "../../../components/songbooks/reader/SongbookReader";
import { SongbookPageView } from "./SongbookPageView";
import {
  bookRevision,
  generate,
  services,
  songbook,
  songbookComponents,
  user,
} from "../../../../../.storybook/fixtures/screens";
const meta = {
  title: "Screens/SongbookPage",
  component: SongbookPageView,
  parameters: {
    route: "/bloco-exemplo/carnaval",
    routePath: "/:slug/:songbookSlug",
  },
  args: {
    services: { ...services, generateSongbookPdfs: generate },
    components: songbookComponents,
  },
} satisfies Meta<typeof SongbookPageView>;
export default meta;
type Story = StoryObj<typeof SongbookPageView>;

export const Published: Story = {};
export const Admin: Story = {
  args: { currentUser: user, role: "admin", components: { SongbookReader } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("link", { name: "Editar Carnaval 2026" })).toHaveAttribute(
      "href",
      "/bloco-exemplo/carnaval/gerenciar?detalhes&editar",
    );
    await expect(canvas.getByRole("link", { name: "Meus projetos" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Duplicar Carnaval 2026" })).toBeVisible();
  },
};
export const Editor: Story = {
  args: { currentUser: user, role: "editor", components: { SongbookReader } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("link", { name: "Trocar versões" })).toBeVisible();
    await expect(canvas.queryByRole("link", { name: "Editar Carnaval 2026" })).toBeNull();
  },
};
export const SignedInVisitor: Story = {
  args: { currentUser: user, role: undefined, components: { SongbookReader } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Duplicar Carnaval 2026" }));
    const body = within(document.body);
    await expect(await body.findByLabelText("Título da cópia")).toHaveValue("Cópia de Carnaval 2026");
    await expect(canvas.queryByRole("link", { name: "Trocar versões" })).toBeNull();
  },
};
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

const labelScores = pinnedVersionItems.flatMap((item) =>
  item.type === "score" ? [item] : [],
);
export const PinnedVersionLabels: Story = {
  args: {
    services: {
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
            labelScores.map((item) => [
              item.score.id,
              item.score.latestRevision.id,
            ]),
          ),
        }),
    },
    components: { SongbookReader },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("v3 · Ary Barroso")).toBeVisible();
    await expect(
      canvas.getByText("bloco-vizinho/v2 · Chiquinha Gonzaga"),
    ).toBeVisible();
    await expect(
      canvas.queryByText("bloco-exemplo/v3 · Ary Barroso"),
    ).toBeNull();
  },
};
