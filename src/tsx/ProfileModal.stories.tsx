import { DialogStory } from "./screenFixtures";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, waitFor } from "@storybook/test";
import { ProfileModalView } from "./ProfileModalView";
import { pending, services, user } from "./screenFixtures";
import { noop } from "./storyFixtures";

const meta = {
  title: "Screens/ProfileModal",
  component: ProfileModalView,
  render: (args) => <DialogStory args={args} Component={ProfileModalView} />,
  parameters: { route: "/", routePath: "/" },
  args: {
    show: true,
    onHide: noop,
    currentUser: user,
    services,
    inboxCount: 1,
  },
} satisfies Meta<typeof ProfileModalView>;
export default meta;
type Story = StoryObj<typeof ProfileModalView>;

export const Profile: Story = {};
export const Password: Story = {
  play: async () => {
    await userEvent.click(
      await within(document.body).findByRole("tab", { name: "Alterar senha" }),
    );
  },
};
export const Invitations: Story = {
  play: async () => {
    await userEvent.click(
      await within(document.body).findByRole("tab", { name: "Convites (1)" }),
    );
    await waitFor(async () => {
      await expect(
        await within(document.body).findByRole("button", { name: "Aceitar" }),
      ).toBeVisible();
    });
  },
};
export const EmptyInbox: Story = {
  args: {
    services: {
      ...services,
      getPendingUserProjectInvitations: () => Promise.resolve([]),
    },
  },
  play: async () => {
    await userEvent.click(
      await within(document.body).findByRole("tab", { name: "Convites (1)" }),
    );
    await waitFor(async () => {
      await expect(
        await within(document.body).findByText("Nenhum convite pendente."),
      ).toBeVisible();
    });
  },
};
export const LoadingInbox: Story = {
  args: {
    services: {
      ...services,
      getPendingUserProjectInvitations: () => pending(),
    },
  },
  play: async () => {
    await userEvent.click(
      await within(document.body).findByRole("tab", { name: "Convites (1)" }),
    );
  },
};

async function profileDialog() {
  const dialog = await within(document.body).findByRole("dialog");
  await waitFor(() => expect(dialog).toHaveFocus());
  return within(dialog);
}
export const SaveSuccess: Story = {
  play: async () => {
    const dialog = await profileDialog();
    await userEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await waitFor(async () => {
      await expect(await dialog.findByText("Nome atualizado!")).toBeVisible();
    });
  },
};
export const SaveError: Story = {
  args: {
    services: {
      ...services,
      updateDisplayName: () =>
        Promise.reject(
          new globalThis.Error("Não foi possível atualizar o nome."),
        ),
    },
  },
  play: async () => {
    const dialog = await profileDialog();
    await userEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await waitFor(async () => {
      await expect(
        await dialog.findByText("Não foi possível atualizar o nome."),
      ).toBeVisible();
    });
  },
};
export const SavePending: Story = {
  args: { services: { ...services, updateDisplayName: () => pending() } },
  play: async () => {
    const dialog = await profileDialog();
    await userEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await expect(dialog.getByRole("button", { name: "Salvar" })).toBeDisabled();
  },
};
