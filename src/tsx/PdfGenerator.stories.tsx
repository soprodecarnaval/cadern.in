import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, waitFor } from "@storybook/test";
import { PDFGeneratorView } from "./PdfGeneratorView";
import { generate, numberedItems, pending } from "./screenFixtures";

const meta = {
  title: "Dialogs/PdfGenerator",
  component: PDFGeneratorView,
  args: { songBook: { items: numberedItems }, generateSongbookPdfs: generate },
} satisfies Meta<typeof PDFGeneratorView>;
export default meta;
type Story = StoryObj<typeof PDFGeneratorView>;
async function open(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.type(
    canvas.getByPlaceholderText("Título do caderninho"),
    "Carnaval 2026",
  );
  await userEvent.click(
    canvas.getByRole("button", { name: "Gerar caderninhos" }),
  );
  const dialog = await within(document.body).findByRole("dialog");
  await waitFor(() => expect(dialog).toHaveFocus());
  return within(dialog);
}
export const Ready: Story = {};
export const Instruments: Story = {
  play: async ({ canvasElement }) => {
    await open(canvasElement);
  },
};
export const Generating: Story = {
  args: {
    generateSongbookPdfs: (options) => {
      options.onStart?.(options.instruments[0]);
      return pending();
    },
  },
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await userEvent.click(
      dialog.getByRole("button", { name: "Gerar 1 caderninho" }),
    );
    await expect(
      await dialog.findByRole("button", { name: "Gerando..." }),
    ).toBeDisabled();
  },
};
export const Completed: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await userEvent.click(
      dialog.getByRole("button", { name: "Gerar 1 caderninho" }),
    );
    await waitFor(async () => {
      await expect(
        await dialog.findByRole("button", { name: "Fechar" }),
      ).toBeVisible();
    });
  },
};
