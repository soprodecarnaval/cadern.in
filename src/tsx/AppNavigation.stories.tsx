import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { AppNavigation } from "./AppNavigation";
import { user } from "./screenFixtures";
const meta = {
  title: "Screens/Navigation",
  component: AppNavigation,
  parameters: { fullScreen: true },
  args: {
    currentUser: user,
    collabEnabled: true,
    inboxCount: 2,
    onOpenUserModal: fn(),
  },
} satisfies Meta<typeof AppNavigation>;
export default meta;
type Story = StoryObj<typeof AppNavigation>;
export const SignedIn: Story = {};
export const SignedOut: Story = { args: { currentUser: null } };
export const Legacy: Story = { args: { collabEnabled: false } };
export const ManyInvitations: Story = { args: { inboxCount: 12 } };
