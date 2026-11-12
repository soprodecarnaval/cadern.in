import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn, userEvent, within, expect, waitFor } from "@storybook/test";
import type { User } from "firebase/auth";
import { AuthModalView } from "./AuthModalView";
import { noop } from "./storyFixtures";

const meta = {
  title: "Components/AuthModal",
  component: AuthModalView,
  args: {
    show: true,
    onHide: noop,
    login: fn(() => Promise.resolve()),
    register: fn(() => Promise.resolve()),
    resetPassword: fn(() => Promise.resolve()),
    pendingUser: null,
    resendVerificationEmail: fn(() => Promise.resolve()),
    refreshVerificationStatus: fn(() => Promise.resolve()),
    logout: fn(() => Promise.resolve()),
  },
  render: function Render(args) {
    const [show, setShow] = useState(args.show);
    return (
      <>
        <button onClick={() => setShow(true)}>Abrir conta</button>
        <AuthModalView {...args} show={show} onHide={() => setShow(false)} />
      </>
    );
  },
} satisfies Meta<typeof AuthModalView>;
export default meta;
type Story = StoryObj<typeof meta>;
const body = () => within(document.body);
async function enterEmail() {
  const dialog = await body().findByRole("dialog");
  await waitFor(() => expect(dialog).toHaveFocus());
  const email = dialog.querySelector<HTMLInputElement>('input[type="email"]')!;
  await userEvent.type(email, "designer@example.test");
  return within(dialog);
}
export const Login: Story = {};
export const Registration: Story = {
  play: async () => {
    await userEvent.click(
      await body().findByRole("tab", { name: "Criar conta" }),
    );
  },
};
export const RejectedLogin: Story = {
  args: {
    login: fn(() => Promise.reject(new Error("Email ou senha inválidos."))),
  },
  play: async () => {
    const dialog = await enterEmail();
    await userEvent.type(
      document.querySelector<HTMLInputElement>('input[type="password"]')!,
      "example-password",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Entrar" }));
    await expect(await dialog.findByRole("alert")).toHaveTextContent(
      "Email ou senha inválidos.",
    );
  },
};
export const ResetPending: Story = {
  args: { resetPassword: fn(() => new Promise<void>(() => undefined)) },
  play: async () => {
    const dialog = await enterEmail();
    await userEvent.click(
      dialog.getByRole("button", { name: "Esqueci a senha" }),
    );
  },
};
export const ResetSuccess: Story = {
  play: async () => {
    const dialog = await enterEmail();
    await userEvent.click(
      dialog.getByRole("button", { name: "Esqueci a senha" }),
    );
    await expect(await dialog.findByRole("alert")).toHaveTextContent(
      "Email de recuperação enviado!",
    );
  },
};
export const PendingVerification: Story = {
  args: {
    pendingUser: { email: "designer@example.test" } as User,
  },
};
export const ResetError: Story = {
  args: {
    resetPassword: fn(() =>
      Promise.reject(new Error("Falha ao enviar email.")),
    ),
  },
  play: async () => {
    const dialog = await enterEmail();
    await userEvent.click(
      dialog.getByRole("button", { name: "Esqueci a senha" }),
    );
    await expect(await dialog.findByRole("alert")).toHaveTextContent(
      "Falha ao enviar email.",
    );
  },
};
