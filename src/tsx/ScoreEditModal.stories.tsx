import { DialogStory } from "./screenFixtures";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ScoreEditModal } from "./ScoreEditModal";
import { score } from "./screenFixtures";
const meta = {
  title: "Dialogs/ScoreEditModal",
  component: ScoreEditModal,
  render: (args) => <DialogStory args={args} Component={ScoreEditModal} />,
  args: { show: true, score, onHide: fn(), onSave: fn() },
} satisfies Meta<typeof ScoreEditModal>;
export default meta;
export const Populated: StoryObj<typeof meta> = {};
export const NoParts: StoryObj<typeof meta> = {
  args: {
    score: { ...score, latestRevision: { ...score.latestRevision, parts: [] } },
  },
};
