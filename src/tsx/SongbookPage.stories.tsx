import { score } from "./screenFixtures";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, waitFor } from "@storybook/test";
import { SongbookPageView } from "./SongbookPageView";
import {
  bookRevision,
  generate,
  services,
  songbook,
  songbookComponents,
  user,
} from "./screenFixtures";
const meta = {
  title: "Screens/SongbookPage",
  component: SongbookPageView,
  parameters: {
    route: "/projects/bloco-exemplo/songbooks/carnaval?detalhes",
    routePath: "/projects/:slug/songbooks/:songbookSlug",
  },
  args: {
    services: { ...services, generateSongbookPdfs: generate },
    currentUser: user,
    role: "owner",
    components: songbookComponents,
  },
} satisfies Meta<typeof SongbookPageView>;
export default meta;
type Story = StoryObj<typeof SongbookPageView>;

export const OwnerDetails: Story = {};
export const PublicDetails: Story = {
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
