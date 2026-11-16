import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within, waitFor } from "@storybook/test";
import { PublicProjectPageView } from "./PublicProjectPageView";
import { pending, services, user, songbook } from "../../../../../.storybook/fixtures/screens";

const projectServices = {
  ...services,
  getProjectSongbooks: fn<typeof import("../../../../lib/db").getProjectSongbooks>((_id, options) =>
    Promise.resolve(options?.publishedOnly ? [songbook] : [songbook, {
      ...songbook, id: "draft", slug: "ensaios", title: "Ensaios 2027", isPublished: false,
    }]),
  ),
};

const meta = {
  title: "Screens/PublicProjectPage",
  component: PublicProjectPageView,
  parameters: {
    route: "/project/bloco-exemplo",
    routePath: "/project/:slug",
  },
  args: { services: projectServices, role: "owner", currentUser: user },
} satisfies Meta<typeof PublicProjectPageView>;
export default meta;
type Story = StoryObj<typeof PublicProjectPageView>;

export const Owner: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: "+ Novo caderninho" })).toBeVisible();
    await expect(await canvas.findByText("Ensaios 2027")).toBeVisible();
    await expect(projectServices.getProjectSongbooks).toHaveBeenCalledWith("bloco-exemplo", { publishedOnly: false });
    await expect(canvas.getByRole("link", { name: "Carnaval 2026" })).toHaveAttribute("href", "/project/bloco-exemplo/songbook/carnaval/manage");
  },
};
export const Public: Story = {
  args: { role: undefined, currentUser: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("link", { name: "Carnaval 2026" })).toHaveAttribute("href", "/project/bloco-exemplo/songbook/carnaval");
    await expect(projectServices.getProjectSongbooks).toHaveBeenCalledWith("bloco-exemplo", { publishedOnly: true });
    await expect(canvas.queryByText("Ensaios 2027")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Partituras")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "+ Novo caderninho" })).not.toBeInTheDocument();
  },
};
export const Reviewer: Story = {
  args: { role: "reviewer" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Ensaios 2027")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "+ Novo caderninho" })).not.toBeInTheDocument();
  },
};
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

export const Admin: Story = { args: { role: "admin" } };
export const Editor: Story = { args: { role: "editor" } };
export const PermissionsLoading: Story = { args: { role: "loading" } };
export const SongbooksLoading: Story = { args: { services: { ...services, getProjectSongbooks: () => pending() } } };
export const PublicEmpty: Story = { args: { role: undefined, currentUser: null, services: { ...services, getProjectSongbooks: () => Promise.resolve([]) } } };
export const LoadFailure: Story = { args: { services: { ...services, getProjectSongbooks: () => Promise.reject(new Error("offline")) } } };
export const CreateAndCancel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "+ Novo caderninho" }));
    await userEvent.type(canvas.getByLabelText("Título do novo caderninho"), "Rascunho");
    await userEvent.click(canvas.getByRole("button", { name: "Cancelar" }));
    await userEvent.click(canvas.getByRole("button", { name: "+ Novo caderninho" }));
    await expect(canvas.getByLabelText("Título do novo caderninho")).toHaveValue("");
  },
};
export const DuplicateTitle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "+ Novo caderninho" }));
    await userEvent.type(canvas.getByLabelText("Título do novo caderninho"), "Carnaval 2026");
    await userEvent.click(canvas.getByRole("button", { name: "Criar" }));
    await expect(await canvas.findByText("Já existe um caderninho com esse título.")).toBeVisible();
  },
};
export const CreateSuccess: Story = {
  args: { services: { ...services, getSongbook: () => Promise.resolve(null) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "+ Novo caderninho" }));
    await userEvent.type(canvas.getByLabelText("Título do novo caderninho"), "Novo repertório");
    await userEvent.click(canvas.getByRole("button", { name: "Criar" }));
    await expect(await canvas.findByText("/project/bloco-exemplo/songbook/novo-repertorio/manage")).toBeVisible();
  },
};
export const CreateFailure: Story = {
  args: { services: { ...services, getSongbook: () => Promise.resolve(null), createSongbook: () => Promise.reject(new Error("Não foi possível criar. Tente novamente.")) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "+ Novo caderninho" }));
    await userEvent.type(canvas.getByLabelText("Título do novo caderninho"), "Novo repertório");
    await userEvent.click(canvas.getByRole("button", { name: "Criar" }));
    await expect(await canvas.findByText("Não foi possível criar. Tente novamente.")).toBeVisible();
    await expect(canvas.getByLabelText("Título do novo caderninho")).toHaveValue("Novo repertório");
    await expect(canvas.getByRole("button", { name: "Criar" })).toBeEnabled();
  },
};
export const Creating: Story = {
  args: { services: { ...services, getSongbook: () => Promise.resolve(null), createSongbook: () => pending() } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "+ Novo caderninho" }));
    await userEvent.type(canvas.getByLabelText("Título do novo caderninho"), "Novo repertório");
    await userEvent.click(canvas.getByRole("button", { name: "Criar" }));
    await expect(await canvas.findByRole("button", { name: /Criando/ })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  },
};
export const InvalidTitle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "+ Novo caderninho" }));
    await userEvent.type(canvas.getByLabelText("Título do novo caderninho"), "!!!");
    await userEvent.click(canvas.getByRole("button", { name: "Criar" }));
    await expect(await canvas.findByText("Informe um título com letras ou números.")).toBeVisible();
  },
};
export const RetryLoad: Story = {
  render: (args) => {
    let attempts = 0;
    return <PublicProjectPageView {...args} services={{ ...services, getProjectSongbooks: () => ++attempts === 1 ? Promise.reject(new Error("offline")) : Promise.resolve([songbook]) }} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Tentar novamente" }));
    await expect(await canvas.findByText("Carnaval 2026")).toBeVisible();
    await waitFor(() => expect(canvas.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument());
  },
};
