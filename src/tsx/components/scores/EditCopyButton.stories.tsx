import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { project, scoreDoc, services, user } from "../../../../.storybook/fixtures/screens";
import { EditCopyButton } from "./EditCopyButton";

const acervo = { ...project, id: "acervo-ana", slug: "acervo-ana", title: "Acervo @ana" };
const copyServices = {
  ...services,
  getUserMemberProjects: () => Promise.resolve([project, acervo]),
};

const meta = {
  title: "Components/EditCopyButton",
  component: EditCopyButton,
  args: {
    // A score of a project the person can't edit.
    score: { scoreId: "outro-marchinha", projectId: "bloco-vizinho", title: "Marchinha do vizinho", revisionId: "revision-4" },
    user,
    services: copyServices,
  },
} satisfies Meta<typeof EditCopyButton>;
export default meta;
type Story = StoryObj<typeof EditCopyButton>;

export const PickProject: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Editar uma cópia" }));
    const body = within(document.body);
    await userEvent.click(await body.findByRole("button", { name: "Abrir formatação" }));
    await expect(await body.findByText("/acervo-ana/enviar?partitura=outro-marchinha&base=revision-4&modo=reformatar")).toBeVisible();
  },
};
export const ExistingCopy: Story = {
  args: {
    services: {
      ...copyServices,
      getScoreForks: () => Promise.resolve([{ ...scoreDoc, id: "bloco-exemplo-marchinha", forkedFrom: { scoreId: "outro-marchinha", revisionId: "revision-3", projectId: "bloco-vizinho" } }]),
    },
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Editar uma cópia" }));
    const body = within(document.body);
    // The project that already has a copy is preselected.
    await body.findByLabelText("Projeto");
    await waitFor(() => expect(body.getByLabelText("Projeto")).toHaveValue(project.id));
  },
};
export const FromSongbook: Story = {
  args: { songbook: { id: "bloco-exemplo~carnaval", projectId: project.id, revisionId: "book-revision-2" } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Editar uma cópia" }));
    const body = within(document.body);
    await expect(await body.findByLabelText("Projeto")).toHaveValue(project.id);
    await userEvent.click(body.getByRole("button", { name: "Abrir formatação" }));
    await expect(await body.findByText(/caderninho=bloco-exemplo%7Ecarnaval&versaoCaderninho=book-revision-2/)).toBeVisible();
  },
};
