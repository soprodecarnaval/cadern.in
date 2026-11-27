import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "@storybook/test";
import { isAdmin } from "../../../lib/roles";
import { project, services, user } from "../../../../.storybook/fixtures/screens";
import { ProjectPickerModal } from "./ProjectPickerModal";

const acervo = { ...project, id: "acervo-ana", slug: "acervo-ana", title: "Acervo @ana" };
const reviewOnly = { ...project, id: "bloco-revisor", slug: "bloco-revisor", title: "Bloco onde revisa" };
const pickerServices = {
  getUserMemberProjects: () => Promise.resolve([project, reviewOnly, acervo]),
  getMemberRole: (id: string) => Promise.resolve(id === reviewOnly.id ? ("reviewer" as const) : ("owner" as const)),
};

const meta = {
  title: "Components/ProjectPickerModal",
  component: ProjectPickerModal,
  args: {
    show: true,
    user,
    services: pickerServices,
    allow: isAdmin,
    heading: "Duplicar caderninho",
    description: "A cópia usa as mesmas versões das partituras e começa não publicada.",
    confirmLabel: "Duplicar e editar",
    nameField: { label: "Título da cópia", initial: "Cópia de Carnaval 2026" },
    onHide: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof ProjectPickerModal>;
export default meta;
type Story = StoryObj<typeof ProjectPickerModal>;

export const WithName: Story = {
  play: async ({ args }) => {
    const body = within(document.body);
    const select = await body.findByLabelText("Projeto");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    // Acervo first; projects without the role are left out.
    await expect(options).toEqual(["Acervo @ana", "Bloco de exemplo"]);
    await expect(body.getByLabelText("Título da cópia")).toHaveValue("Cópia de Carnaval 2026");
    await userEvent.click(body.getByRole("button", { name: "Duplicar e editar" }));
    await expect(args.onConfirm).toHaveBeenCalledWith("acervo-ana", "Cópia de Carnaval 2026");
  },
};
export const ProjectOnly: Story = {
  args: { heading: "Enviar partitura", confirmLabel: "Continuar", nameField: undefined, description: undefined },
};
export const PreferredProject: Story = {
  args: { preferredProjectId: project.id },
  play: async () => {
    const body = within(document.body);
    await expect(await body.findByLabelText("Projeto")).toHaveValue(project.id);
  },
};
export const NoProjects: Story = {
  args: { services: { ...pickerServices, getUserMemberProjects: () => Promise.resolve([reviewOnly]) } },
  play: async () => {
    const body = within(document.body);
    const link = await body.findByRole("link", { name: "Criar um novo projeto" });
    await waitFor(() => expect(link).toBeVisible());
  },
};
export const ConfirmFailure: Story = {
  args: { onConfirm: () => Promise.reject(new Error("Não foi possível duplicar. Tente novamente.")) },
  play: async () => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole("button", { name: "Duplicar e editar" }));
    await expect(await body.findByRole("alert")).toHaveTextContent("Não foi possível duplicar");
  },
};
export const LoadFailure: Story = {
  args: { services: { ...services, getUserMemberProjects: () => Promise.reject(new Error("offline")) } },
};
