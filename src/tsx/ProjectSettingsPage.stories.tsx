import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, waitFor } from "@storybook/test";
import { ProjectSettingsPageView } from "./ProjectSettingsPageView";
import { fail, services, user } from "./screenFixtures";

const meta = {
  title: "Screens/ProjectSettingsPage",
  component: ProjectSettingsPageView,
  parameters: {
    route: "/projects/bloco-exemplo/settings",
    routePath: "/projects/:slug/settings",
  },
  args: { services, currentUser: user, myRole: "owner" },
} satisfies Meta<typeof ProjectSettingsPageView>;
export default meta;
type Story = StoryObj<typeof ProjectSettingsPageView>;

export const Owner: Story = {};
export const Admin: Story = { args: { myRole: "admin" } };
export const Forbidden: Story = { args: { myRole: "reviewer" } };
export const SignedOut: Story = { args: { currentUser: null } };
export const Loading: Story = { args: { myRole: "loading" } };
export const NotFound: Story = {
  args: {
    services: { ...services, getProjectBySlug: () => Promise.resolve(null) },
  },
};
export const NoInvitations: Story = {
  args: {
    services: {
      ...services,
      getProjectUserProjectInvitations: () => Promise.resolve([]),
    },
  },
};
export const SaveError: Story = {
  args: { services: { ...services, updateProjectTitle: fail } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Salvar" }),
    );
    await waitFor(async () => {
      await expect(
        await canvas.findByText("Não foi possível salvar. Tente novamente."),
      ).toBeVisible();
    });
  },
};
