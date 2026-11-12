import type { Meta, StoryObj } from "@storybook/react";
import { PublicProjectPageView } from "./PublicProjectPageView";
import { pending, services } from "./screenFixtures";

const meta = {
  title: "Screens/PublicProjectPage",
  component: PublicProjectPageView,
  parameters: {
    route: "/projects/bloco-exemplo",
    routePath: "/projects/:slug",
  },
  args: { services, role: "owner" },
} satisfies Meta<typeof PublicProjectPageView>;
export default meta;
type Story = StoryObj<typeof PublicProjectPageView>;

export const Owner: Story = {};
export const Public: Story = { args: { role: undefined } };
export const Reviewer: Story = { args: { role: "reviewer" } };
export const Loading: Story = {
  args: { services: { ...services, getProjectBySlug: () => pending() } },
};
export const NotFound: Story = {
  args: {
    services: { ...services, getProjectBySlug: () => Promise.resolve(null) },
  },
};
export const Empty: Story = {
  args: {
    services: {
      ...services,
      getProjectSongbooks: () => Promise.resolve([]),
      getProjectScores: () => Promise.resolve([]),
    },
  },
};
