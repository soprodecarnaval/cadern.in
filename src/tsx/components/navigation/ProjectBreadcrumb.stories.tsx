import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { ProjectBreadcrumb } from "./ProjectBreadcrumb";

const meta = {
  title: "Components/ProjectBreadcrumb",
  component: ProjectBreadcrumb,
  args: {
    signedIn: true,
    project: { id: "bloco-exemplo", title: "Bloco Exemplo" },
  },
} satisfies Meta<typeof ProjectBreadcrumb>;
export default meta;
type Story = StoryObj<typeof ProjectBreadcrumb>;

export const Project: Story = {};
export const SongbookScore: Story = {
  args: {
    songbook: { slug: "carnaval", title: "Carnaval 2026", member: true },
    score: { id: "bloco-exemplo-cidade-maravilhosa", title: "Cidade Maravilhosa" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Meus projetos" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Carnaval 2026" })).toHaveAttribute(
      "href",
      "/bloco-exemplo/carnaval/gerenciar",
    );
    await expect(canvas.getByText("Cidade Maravilhosa")).toHaveAttribute("aria-current", "page");
  },
};
export const CurrentStep: Story = { args: { current: "Enviar partitura" } };
export const SignedOut: Story = {
  args: {
    signedIn: false,
    songbook: { slug: "carnaval", title: "Carnaval 2026" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("Meus projetos")).toBeNull();
  },
};
