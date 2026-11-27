import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "@storybook/test";
import { TbPencil, TbTrash } from "react-icons/tb";
import { ScoreCardView } from "./ScoreCardView";
import { score, noop } from "../../../../../.storybook/fixtures/components";

const meta = {
  title: "Components/ScoreCard",
  component: ScoreCardView,
  args: {
    score,
    mode: "compact",
    onToggleMode: noop,
    onShowDetail: fn(),
    trailing: <button className="btn btn-outline-primary">Adicionar</button>,
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
// A song with MIDI and MuseScore files, as in a songbook: every icon the
// card can show, eye, play (MIDI), note (MuseScore), pencil and trash.
export const WithMidi: Story = {
  args: {
    score: {
      ...score,
      latestRevision: { ...score.latestRevision, midi: "#fixture-midi", mscz: "#fixture-mscz" },
    },
    trailing: (
      <div className="score-card-actions">
        <button type="button" className="btn btn-link ds-button p-0" aria-label="Editar">
          <TbPencil className="tabler-icon" aria-hidden="true" />
        </button>
        <button type="button" className="btn btn-link ds-button p-0" aria-label="Remover">
          <TbTrash className="tabler-icon" aria-hidden="true" />
        </button>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "MIDI" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "MuseScore" })).toBeVisible();
  },
};
