import { DialogStory } from "./screenFixtures";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { SaveSongbookModalView } from "./SaveSongbookModalView";
import { builderItems, fail, pending, services, user } from "./screenFixtures";
import { noop } from "./storyFixtures";

const meta = {
  title: "Screens/SaveSongbookModal",
  component: SaveSongbookModalView,
  render: (args) => (
    <DialogStory args={args} Component={SaveSongbookModalView} />
  ),
  parameters: { route: "/", routePath: "/" },
  args: { show: true, onHide: noop, user, items: builderItems, services },
} satisfies Meta<typeof SaveSongbookModalView>;
export default meta;
type Story = StoryObj<typeof SaveSongbookModalView>;

export const Ready: Story = {};
export const Loading: Story = {
  args: {
    services: { ...services, getOrCreateDefaultProject: () => pending() },
  },
};
export const EmptySelection: Story = { args: { items: [] } };
export const SaveError: Story = {
  args: { services: { ...services, saveAsNewSongbook: fail } },
  play: async () => {
    const body = within(document.body);
    const dialog = await body.findByRole("dialog");
    await waitFor(() => expect(dialog).toHaveFocus());
    await waitFor(() => expect(dialog.querySelector("input")).not.toBeNull());
    await userEvent.type(
      dialog.querySelector<HTMLInputElement>("input")!,
      "Novo caderninho",
    );
    await userEvent.click(body.getByRole("button", { name: "Salvar" }));
    await waitFor(async () => {
      await expect(
        await body.findByText("Não foi possível salvar. Tente novamente."),
      ).toBeVisible();
    });
  },
};
