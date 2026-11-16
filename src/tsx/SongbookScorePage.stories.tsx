import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { ReviewCommentsPanelView } from "./ReviewCommentsPanelView";
import { ScoreDisplay } from "./ScoreDisplay";
import { SongbookScorePageView } from "./SongbookScorePageView";
import {
  bookRevision,
  comment,
  scoreDoc,
  services,
  songbook,
  user,
} from "./screenFixtures";

const components = {
  ScoreDisplay,
  ReviewCommentsPanel: ReviewCommentsPanelView,
};

const meta = {
  title: "Screens/SongbookScorePage",
  component: SongbookScorePageView,
  parameters: {
    route: "/project/bloco-exemplo/songbook/carnaval/manage/score/fixture-score",
    routePath: "/project/:slug/songbook/:songbookSlug/manage/score/:scoreId",
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
    await expect(await canvas.findByText(scoreDoc.title)).toBeVisible();
    await expect(canvas.getByText(songbook.title)).toBeVisible();
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
