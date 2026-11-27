import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { bookRevision, services, songbook, user } from "../../../../.storybook/fixtures/screens";
import { DuplicateSongbookButton } from "./DuplicateSongbookButton";

const meta = {
  title: "Components/DuplicateSongbookButton",
  component: DuplicateSongbookButton,
  args: {
    songbook,
    user,
    services: {
      ...services,
      // Only the source's slug is taken in the target project.
      getSongbook: (_projectId: string, slug: string) => Promise.resolve(slug === songbook.slug ? songbook : null),
      createSongbook: fn(() => Promise.resolve("bloco-exemplo~copia-de-carnaval-2026")),
    },
  },
} satisfies Meta<typeof DuplicateSongbookButton>;
export default meta;
type Story = StoryObj<typeof DuplicateSongbookButton>;

export const Duplicate: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Duplicar Carnaval 2026" }));
    const body = within(document.body);
    await expect(await body.findByLabelText("Título da cópia")).toHaveValue("Cópia de Carnaval 2026");
    await userEvent.click(body.getByRole("button", { name: "Duplicar e editar" }));
    await expect(args.services.createSongbook).toHaveBeenCalledWith(expect.objectContaining({
      projectId: "bloco-exemplo",
      slug: "copia-de-carnaval-2026",
      content: { entries: bookRevision.entries, pins: bookRevision.pins, covers: bookRevision.covers },
    }));
    await expect(await body.findByText("/bloco-exemplo/copia-de-carnaval-2026/gerenciar")).toBeVisible();
  },
};
export const SignedOut: Story = {
  args: { user: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};
