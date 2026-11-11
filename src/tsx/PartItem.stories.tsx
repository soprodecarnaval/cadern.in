import type { Meta, StoryObj } from "@storybook/react";
import { fn, userEvent, within, expect } from "@storybook/test";
import { PartItemView } from "./PartItemView";
import { part, score } from "./storyFixtures";

const meta = {
  title: "Components/PartItem",
  component: PartItemView,
  args: {
    part,
    score,
    handlePlayingSong: fn(),
    onOpenPreview: fn(),
    play: fn(() => Promise.resolve()),
    stop: fn(),
  },
} satisfies Meta<typeof PartItemView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WithMidi: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("flauta"));
    await expect(args.onOpenPreview).toHaveBeenCalled();
    await userEvent.click(
      canvasElement.querySelector<SVGElement>(".play-icon-part")!,
    );
    await expect(args.handlePlayingSong).toHaveBeenCalledWith({ score, part });
    await expect(args.play).toHaveBeenCalledWith(part);
    await userEvent.click(
      canvasElement.querySelector<SVGElement>(".pause-icon-part")!,
    );
    await expect(args.stop).toHaveBeenCalled();
  },
};
export const WithoutMidi: Story = { args: { part: { ...part, midi: "" } } };
