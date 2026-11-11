import type { Meta, StoryObj } from "@storybook/react";
import { fn, userEvent, within, expect, waitFor } from "@storybook/test";
import { SearchBarView } from "./SearchBarView";
import { score } from "./storyFixtures";

const meta = {
  title: "Components/SearchBar",
  component: SearchBarView,
  args: {
    status: "ready",
    search: (query: string) =>
      !query || score.title.toLowerCase().includes(query.toLowerCase())
        ? [score]
        : [],
    handleResults: fn(),
  },
} satisfies Meta<typeof SearchBarView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Loading: Story = { args: { status: "loading" } };
export const Error: Story = { args: { status: "error" } };
export const EnteredQuery: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.type(
      within(canvasElement).getByRole("searchbox"),
      "Carnaval",
    );
    await waitFor(() =>
      expect(args.handleResults).toHaveBeenLastCalledWith([score], "Carnaval"),
    );
  },
};
