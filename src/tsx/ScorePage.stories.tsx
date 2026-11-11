import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, waitFor } from "@storybook/test";
import { ScorePageView } from "./ScorePageView";
import {
  loadedScore,
  metadata,
  pending,
  scoreComponents,
  services,
  user,
} from "./screenFixtures";
const meta = {
  title: "Screens/ScorePage",
  component: ScorePageView,
  parameters: {
    route: "/score/fixture-score",
    routePath: "/score/:scoreId/:revisionId?",
  },
  args: {
    services,
    currentUser: user,
    collabEnabled: true,
    components: scoreComponents,
  },
} satisfies Meta<typeof ScorePageView>;
export default meta;
type Story = StoryObj<typeof ScorePageView>;

export const Review: Story = {};
export const Public: Story = { args: { currentUser: null } };
export const Legacy: Story = { args: { collabEnabled: false } };
export const Loading: Story = {
  args: { services: { ...services, loadScore: () => pending() } },
};
export const Error: Story = {
  args: {
    services: {
      ...services,
      loadScore: () =>
        Promise.reject(new globalThis.Error("Partitura não encontrada")),
    },
  },
};
export const NoParts: Story = {
  args: {
    services: {
      ...services,
      loadScore: () =>
        Promise.resolve({ ...metadata, ...loadedScore, parts: [] }),
    },
  },
};
export const EditMetadata: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Editar metadados" }),
    );
    await waitFor(async () => {
      await expect(
        await within(document.body).findByRole("dialog"),
      ).toBeVisible();
    });
  },
};

export const Reviewer: Story = {
  args: {
    services: { ...services, getMemberRole: () => Promise.resolve("reviewer") },
  },
};
export const NoComments: Story = {
  args: { services: { ...services, getComments: () => Promise.resolve([]) } },
};
export const PickingComment: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "📍 Marcar ponto" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Clique na partitura…" }),
    ).toBeVisible();
  },
};
