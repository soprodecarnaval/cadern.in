import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { ReviewCommentsPanelView } from "../../../components/review/ReviewCommentsPanelView";
import { SongbookScorePageView } from "./SongbookScorePageView";
import {
  bookRevision,
  comment,
  scoreDoc,
  scoreComponents,
  services,
  songbook,
  user,
} from "../../../../../.storybook/fixtures/screens";

const components = {
  ScoreDisplay: scoreComponents.ScoreDisplay,
  ReviewCommentsPanel: ReviewCommentsPanelView,
};

const meta = {
  title: "Screens/SongbookScorePage",
  component: SongbookScorePageView,
  parameters: {
    route: "/bloco-exemplo/carnaval/gerenciar/partituras/fixture-score",
    routePath: "/:slug/:songbookSlug/gerenciar/partituras/:scoreId",
  },
  args: {
    services,
    currentUser: user,
    role: "owner",
    components,
  },
} satisfies Meta<typeof SongbookScorePageView>;
export default meta;
type Story = StoryObj<typeof SongbookScorePageView>;

export const OwnProject: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect((await canvas.findAllByText(scoreDoc.title)).length).toBeGreaterThan(0);
    await expect(canvas.getAllByText(songbook.title).length).toBeGreaterThan(0);
    await expect(
      await canvas.findByText(comment.body),
    ).toBeVisible();
    await expect(canvas.queryByText("de outro projeto")).toBeNull();
  },
};

export const ForeignScore: Story = {
  args: {
    services: {
      ...services,
      getScore: () =>
        Promise.resolve({ ...scoreDoc, projectId: "bloco-vizinho" }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("de outro projeto")).toBeVisible();
  },
};

export const ForeignPrivateScore: Story = {
  args: {
    services: {
      ...services,
      getMemberRole: () => Promise.resolve(undefined),
      getScore: () => Promise.resolve({
        ...scoreDoc, projectId: "bloco-vizinho", published: null,
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("de outro projeto")).toBeVisible();
    await expect(canvas.queryByText(comment.body)).not.toBeInTheDocument();
    await expect(canvas.queryByPlaceholderText("Escreva um comentário sobre esta versão")).not.toBeInTheDocument();
  },
};

export const MissingEntry: Story = {
  args: {
    services: {
      ...services,
      getSongbookRevision: () =>
        Promise.resolve({ ...bookRevision, pins: {} }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(/não está mais neste caderninho/),
    ).toBeVisible();
  },
};

export const AccessDenied: Story = {
  args: { role: undefined, currentUser: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(/não é membro deste projeto/),
    ).toBeVisible();
  },
};

export const Loading: Story = { args: { role: "loading" } };

export const SongbookNotFound: Story = {
  args: {
    services: { ...services, getSongbook: () => Promise.resolve(null) },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText("Caderninho não encontrado."),
    ).toBeVisible();
  },
};
