import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, waitFor } from "@storybook/test";
import { ProjectSongbooksPageView } from "./ProjectSongbooksPageView";
import { services, user } from "./screenFixtures";

const meta = {
  title: "Screens/ProjectSongbooksPage",
  component: ProjectSongbooksPageView,
  parameters: {
    route: "/projects/bloco-exemplo/songbooks",
    routePath: "/projects/:slug/songbooks",
  },
  args: { services, currentUser: user, role: "owner" },
} satisfies Meta<typeof ProjectSongbooksPageView>;
export default meta;
type Story = StoryObj<typeof ProjectSongbooksPageView>;

export const Owner: Story = {};
export const Public: Story = { args: { role: undefined, currentUser: null } };
export const Loading: Story = { args: { role: "loading" } };
export const NotFound: Story = {
  args: {
    services: { ...services, getProjectBySlug: () => Promise.resolve(null) },
  },
};
export const Empty: Story = {
  args: {
    services: { ...services, getProjectSongbooks: () => Promise.resolve([]) },
  },
};
export const DuplicateTitle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      await canvas.findByPlaceholderText("Título do novo caderninho"),
      "Carnaval 2026",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Criar" }));
    await waitFor(async () => {
      await expect(
        await canvas.findByText("Já existe um caderninho com esse título."),
      ).toBeVisible();
    });
  },
};
