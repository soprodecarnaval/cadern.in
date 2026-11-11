import { DialogStory } from "./screenFixtures";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within, waitFor } from "@storybook/test";
import { ScoreMetadataEditorView } from "./ScoreMetadataEditorView";
import { fail, metadata, score, services, pending } from "./screenFixtures";
import { noop } from "./storyFixtures";

const meta = {
  title: "Screens/ScoreMetadataEditor",
  component: ScoreMetadataEditorView,
  render: (args) => (
    <DialogStory args={args} Component={ScoreMetadataEditorView} />
  ),
  parameters: { route: "/", routePath: "/" },
  args: {
    show: true,
    onHide: noop,
    onSaved: fn(),
    scoreId: score.id,
    uploaded: metadata,
    current: metadata,
    services,
  },
} satisfies Meta<typeof ScoreMetadataEditorView>;
export default meta;
type Story = StoryObj<typeof ScoreMetadataEditorView>;

export const Original: Story = {};
export const Overridden: Story = {
  args: { current: { ...metadata, title: "Título corrigido" } },
};
export const SaveError: Story = {
  args: { services: { ...services, updateScoreMetadataOverride: fail } },
  play: async () => {
    await userEvent.click(
      await within(document.body).findByRole("button", { name: "Salvar" }),
    );
    await waitFor(async () => {
      await expect(
        await within(document.body).findByText(
          "Não foi possível salvar. Tente novamente.",
        ),
      ).toBeVisible();
    });
  },
};

export const SavePending: Story = {
  args: {
    services: { ...services, updateScoreMetadataOverride: () => pending() },
  },
  play: async () => {
    const body = within(document.body);
    const dialog = await body.findByRole("dialog");
    await waitFor(() => expect(dialog).toHaveFocus());
    await userEvent.click(body.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(dialog.querySelector(".modal-footer .btn-primary")).toBeDisabled(),
    );
  },
};
