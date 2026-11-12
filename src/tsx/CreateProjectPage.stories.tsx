import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { CreateProjectPageView } from "./CreateProjectPageView";
import { fail, pending, services, user } from "./screenFixtures";

const meta = {
  title: "Screens/CreateProjectPage",
  component: CreateProjectPageView,
  parameters: { route: "/projects/new", routePath: "/projects/new" },
  args: {
    services: { ...services, getProjectBySlug: () => Promise.resolve(null) },
    currentUser: user,
  },
} satisfies Meta<typeof CreateProjectPageView>;
export default meta;
type Story = StoryObj<typeof CreateProjectPageView>;

async function submit(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.type(
    canvas.getByPlaceholderText("Nome do projeto"),
    "Meu novo bloco",
  );
  await userEvent.click(canvas.getByRole("button", { name: "Criar projeto" }));
}
export const Blank: Story = {};
export const SignedOut: Story = { args: { currentUser: null } };
export const Filled: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(
      within(canvasElement).getByPlaceholderText("Nome do projeto"),
      "Meu novo bloco",
    );
  },
};
export const DuplicateSlug: Story = {
  args: { services },
  play: async ({ canvasElement }) => {
    await submit(canvasElement);
    await expect(
      await within(canvasElement).findByRole("alert"),
    ).toHaveTextContent("já está em uso");
  },
};
export const Pending: Story = {
  args: {
    services: {
      ...services,
      getProjectBySlug: () => Promise.resolve(null),
      createProject: () => pending(),
    },
  },
  play: async ({ canvasElement }) => {
    await submit(canvasElement);
  },
};
export const Error: Story = {
  args: {
    services: {
      ...services,
      getProjectBySlug: () => Promise.resolve(null),
      createProject: fail,
    },
  },
  play: async ({ canvasElement }) => {
    await submit(canvasElement);
    await expect(
      await within(canvasElement).findByRole("alert"),
    ).toHaveTextContent("Não foi possível salvar");
  },
};
