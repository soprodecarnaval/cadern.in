import type { Meta, StoryObj } from "@storybook/react";
import { PartItemView } from "./PartItemView";
import { part } from "./storyFixtures";

const meta = {
  title: "Components/PartItem",
  component: PartItemView,
  args: { part },
} satisfies Meta<typeof PartItemView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const InstrumentPill: Story = {};
