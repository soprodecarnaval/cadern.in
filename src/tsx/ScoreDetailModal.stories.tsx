import { DialogStory } from "./screenFixtures";
import type { Meta, StoryObj } from "@storybook/react";
import { ScoreDetailModalView } from "./ScoreDetailModalView";
import {
  pending,
  score,
  scoreComponents,
  services,
  user,
} from "./screenFixtures";
import { noop } from "./storyFixtures";

const meta = {
  title: "Screens/ScoreDetailModal",
  component: ScoreDetailModalView,
  render: (args) => (
    <DialogStory args={args} Component={ScoreDetailModalView} />
  ),
  parameters: { route: "/", routePath: "/" },
  args: {
    show: true,
    onHide: noop,
    scoreId: score.id,
    services,
    currentUser: user,
    collabEnabled: true,
    components: scoreComponents,
  },
} satisfies Meta<typeof ScoreDetailModalView>;
export default meta;
type Story = StoryObj<typeof ScoreDetailModalView>;

export const Populated: Story = {};
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
