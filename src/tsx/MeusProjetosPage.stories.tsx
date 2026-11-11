import type { Meta, StoryObj } from "@storybook/react";
import { MeusProjetosPageView } from "./MeusProjetosPageView";
import { pending, services, user } from "./screenFixtures";

const meta = {
  title: "Screens/MeusProjetosPage",
  component: MeusProjetosPageView,
  parameters: { route: "/projects", routePath: "/projects" },
  args: { services, currentUser: user },
} satisfies Meta<typeof MeusProjetosPageView>;
export default meta;
type Story = StoryObj<typeof MeusProjetosPageView>;

export const Populated: Story = {};
export const SignedOut: Story = { args: { currentUser: null } };
export const Loading: Story = {
  args: { services: { ...services, getUserMemberProjects: () => pending() } },
};
export const Empty: Story = {
  args: {
    services: { ...services, getUserMemberProjects: () => Promise.resolve([]) },
  },
};
export const Reviewer: Story = {
  args: {
    services: { ...services, getMemberRole: () => Promise.resolve("reviewer") },
  },
};
