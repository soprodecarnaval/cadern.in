import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within, waitFor } from "@storybook/test";
import { HomePageView } from "./HomePageView";
import { collection, homeComponents, storage, user } from "./screenFixtures";

const meta = {
  title: "Screens/HomePage",
  component: HomePageView,
  parameters: { route: "/", routePath: "/", fullScreen: true },
  args: {
    currentUser: user,
    collection,
    storage,
    collabEnabled: true,
    components: homeComponents,
    onRequestLogin: fn(),
  },
} satisfies Meta<typeof HomePageView>;
export default meta;
type Story = StoryObj<typeof HomePageView>;

export const PopulatedBuilder: Story = {};
export const SignedOut: Story = { args: { currentUser: null } };
export const Legacy: Story = { args: { collabEnabled: false } };
export const Loading: Story = {
  args: { collection: { ...collection, status: "loading" } },
};
export const CollectionError: Story = {
  args: { collection: { ...collection, status: "error" } },
};
export const Empty: Story = {
  args: {
    collection: { ...collection, allScores: [], search: () => [] },
    storage: { ...storage, restoreBuilderItems: () => [] },
  },
};
export const NoSearchResults: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(
      within(canvasElement).getByRole("searchbox"),
      "inexistente",
    );
  },
};
export const SaveDialog: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Salvar caderninho" }),
    );
    await waitFor(async () => {
      await expect(
        await within(document.body).findByRole("dialog"),
      ).toBeVisible();
    });
  },
};
