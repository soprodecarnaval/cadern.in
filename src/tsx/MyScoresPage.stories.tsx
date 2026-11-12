import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, waitFor } from "@storybook/test";
import { MyScoresPageView } from "./MyScoresPageView";
import { pending, services, user } from "./screenFixtures";

const meta = {
  title: "Screens/MyScoresPage",
  component: MyScoresPageView,
  parameters: { route: "/", routePath: "/" },
  args: { services, currentUser: user },
} satisfies Meta<typeof MyScoresPageView>;
export default meta;
type Story = StoryObj<typeof MyScoresPageView>;

export const Populated: Story = {};
export const SignedOut: Story = { args: { currentUser: null } };
export const Loading: Story = {
  args: { services: { ...services, getUserScores: () => pending() } },
};
export const Empty: Story = {
  args: { services: { ...services, getUserScores: () => Promise.resolve([]) } },
};
export const ExpandedRevisions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Expandir" }),
    );
    await waitFor(async () => {
      await waitFor(async () => {
        await expect(await canvas.findByText("Versão #2")).toBeVisible();
      });
    });
  },
};
