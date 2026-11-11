import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ScoreCardView } from "./ScoreCardView";
import { score, noop } from "./storyFixtures";

const meta = {
  title: "Components/ScoreCard",
  component: ScoreCardView,
  args: {
    score,
    mode: "compact",
    onToggleMode: noop,
    onShowDetail: fn(),
    trailing: <button className="btn btn-outline-primary">Adicionar</button>,
    lineage: "Carnaval BH 2020 → (…) → Carnaval BH 2025 → Carnaval BH 2026",
  },
  render: function Render(args) {
    const [mode, setMode] = useState(args.mode);
    return (
      <ScoreCardView
        {...args}
        mode={mode}
        onToggleMode={() =>
          setMode(mode === "compact" ? "expanded" : "compact")
        }
      />
    );
  },
} satisfies Meta<typeof ScoreCardView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Compact: Story = {};
export const Expanded: Story = { args: { mode: "expanded" } };
export const NoParts: Story = {
  args: {
    mode: "expanded",
    score: { ...score, latestRevision: { ...score.latestRevision, parts: [] } },
  },
};
export const Highlighted: Story = { args: { highlight: { title: [[0, 7]] } } };
