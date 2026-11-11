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
    onPlay: fn(),
    trailing: <button className="btn btn-outline-primary">Adicionar</button>,
    play: fn(() => Promise.resolve()),
    stop: fn(),
    renderPreview: (parts, index, setIndex) => (
      <div role="dialog" aria-label="Prévia da parte">
        <img alt={parts[index].instrument} src={parts[index].svg[0]} />
        <button onClick={() => setIndex(null)}>Fechar</button>
      </div>
    ),
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
