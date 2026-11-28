import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within, waitFor } from "@storybook/test";
import { PublicProjectPageView } from "./PublicProjectPageView";
import { pending, score, services, user, songbook } from "../../../../../.storybook/fixtures/screens";

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
    route: "/bloco-exemplo",
    routePath: "/:slug",
  },
  args: { services: projectServices, role: "owner", currentUser: user },
} satisfies Meta<typeof PublicProjectPageView>;
export default meta;
type Story = StoryObj<typeof PublicProjectPageView>;

export const Owner: Story = {
  args: { services: { ...projectServices, setSongbookPublished: fn(() => Promise.resolve()) } },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: "Novo caderninho" })).toBeVisible();
    await expect(await canvas.findByText("Ensaios 2027")).toBeVisible();
    await expect(projectServices.getProjectSongbooks).toHaveBeenCalledWith("bloco-exemplo", { publishedOnly: false });
    await expect(canvas.getByRole("link", { name: "Carnaval 2026" })).toHaveAttribute("href", "/bloco-exemplo/carnaval/gerenciar");
    await expect(canvas.getByRole("link", { name: "Editar Ensaios 2027" })).toHaveAttribute("href", "/bloco-exemplo/ensaios/gerenciar?detalhes&editar");
    await expect(canvas.getByRole("link", { name: "Gerenciar Ensaios 2027" })).toHaveAttribute("href", "/bloco-exemplo/ensaios/gerenciar?detalhes");
    await expect(canvas.queryByRole("button", { name: "Publicar Carnaval 2026" })).toBeNull();
    await expect(canvas.getByRole("button", { name: "Duplicar Carnaval 2026" })).toBeVisible();
    await expect(canvas.getByRole("navigation", { name: "Navegação do projeto" })).toHaveTextContent("Meus projetos");
    await userEvent.click(canvas.getByRole("button", { name: "Publicar Ensaios 2027" }));
    await expect(args.services.setSongbookPublished).toHaveBeenCalledWith("draft", true);
    await waitFor(() => expect(canvas.queryByRole("button", { name: "Publicar Ensaios 2027" })).toBeNull());
    // Published caderninhos get "Despublicar" in the same place.
    await userEvent.click(canvas.getByRole("button", { name: "Despublicar Carnaval 2026" }));
    await expect(args.services.setSongbookPublished).toHaveBeenCalledWith(songbook.id, false);
    await expect(await canvas.findByRole("button", { name: "Publicar Carnaval 2026" })).toBeVisible();
  },
};
export const Public: Story = {
  args: { role: undefined, currentUser: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("link", { name: "Carnaval 2026" })).toHaveAttribute("href", "/bloco-exemplo/carnaval");
    await expect(projectServices.getProjectSongbooks).toHaveBeenCalledWith("bloco-exemplo", { publishedOnly: true });
    await expect(canvas.queryByText("Ensaios 2027")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Partituras")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Novo caderninho" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Duplicar Carnaval 2026" })).not.toBeInTheDocument();
  },
};
export const PrintOptions: Story = {
  args: {
    role: undefined,
    currentUser: null,
    services: {
      ...projectServices,
      loadPinnedScores: () => Promise.resolve(new Map([[score.id, {
        score: { ...score, latestRevision: { ...score.latestRevision, arrangementSvg: ["/arrangement.svg"] } },
        latestRevisionId: score.latestRevision.id,
        deleted: false,
      }]])),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Imprimir Carnaval 2026" }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: "Imprimir Carnaval 2026" }));
    const allParts = await dialog.findByRole("checkbox", { name: "Todas as partes" });
    const arrangements = dialog.getByRole("checkbox", { name: "Arranjos (A4 horizontal)" });
    const download = dialog.getByRole("button", { name: "Baixar PDFs" });
    await expect(download).toBeDisabled();
    await userEvent.click(allParts);
    const parts = dialog.getAllByRole("checkbox").filter((checkbox) => checkbox !== allParts && checkbox !== arrangements);
    for (const part of parts) {await expect(part).toBeChecked();}
    await expect(arrangements).not.toBeChecked();
    await userEvent.click(arrangements);
    await userEvent.click(allParts);
    for (const part of parts) {await expect(part).not.toBeChecked();}
    await expect(arrangements).toBeChecked();
    await expect(download).toBeEnabled();
  },
};
export const Reviewer: Story = {
  args: { role: "reviewer" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Ensaios 2027")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Novo caderninho" })).not.toBeInTheDocument();
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

export const Admin: Story = {
  args: { role: "admin" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("link", { name: "Editar Ensaios 2027" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Publicar Ensaios 2027" })).toBeNull();
    await expect(canvas.queryByRole("button", { name: "Despublicar Carnaval 2026" })).toBeNull();
  },
};
export const Editor: Story = { args: { role: "editor" } };
export const PermissionsLoading: Story = { args: { role: "loading" } };
export const SongbooksLoading: Story = { args: { services: { ...services, getProjectSongbooks: () => pending() } } };
export const PublicEmpty: Story = { args: { role: undefined, currentUser: null, services: { ...services, getProjectSongbooks: () => Promise.resolve([]) } } };
export const LoadFailure: Story = { args: { services: { ...services, getProjectSongbooks: () => Promise.reject(new Error("offline")) } } };
export const CreateAndCancel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Novo caderninho" }));
    await userEvent.type(canvas.getByLabelText("Título do novo caderninho"), "Rascunho");
    await userEvent.click(canvas.getByRole("button", { name: "Cancelar" }));
    await userEvent.click(canvas.getByRole("button", { name: "Novo caderninho" }));
    await expect(canvas.getByLabelText("Título do novo caderninho")).toHaveValue("");
  },
};
export const DuplicateTitle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Novo caderninho" }));
    await userEvent.type(canvas.getByLabelText("Título do novo caderninho"), "Carnaval 2026");
    await userEvent.click(canvas.getByRole("button", { name: "Criar" }));
    await expect(await canvas.findByText("Já existe um caderninho com esse título.")).toBeVisible();
  },
};
export const CreateSuccess: Story = {
  args: { services: { ...services, getSongbook: () => Promise.resolve(null) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Novo caderninho" }));
    await userEvent.type(canvas.getByLabelText("Título do novo caderninho"), "Novo repertório");
    await userEvent.click(canvas.getByRole("button", { name: "Criar" }));
    // Into the new songbook's editor.
    await expect(await canvas.findByText("/bloco-exemplo/novo-repertorio/gerenciar?detalhes&editar")).toBeVisible();
  },
};
export const CreateFailure: Story = {
  args: { services: { ...services, getSongbook: () => Promise.resolve(null), createSongbook: () => Promise.reject(new Error("Não foi possível criar. Tente novamente.")) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Novo caderninho" }));
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
    await userEvent.click(await canvas.findByRole("button", { name: "Novo caderninho" }));
    await userEvent.type(canvas.getByLabelText("Título do novo caderninho"), "Novo repertório");
    await userEvent.click(canvas.getByRole("button", { name: "Criar" }));
    await expect(await canvas.findByRole("button", { name: /Criando/ })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  },
};
export const InvalidTitle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Novo caderninho" }));
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
