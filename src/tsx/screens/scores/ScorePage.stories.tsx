import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, waitFor } from "@storybook/test";
import { ScorePageView } from "./ScorePageView";
import { projectPath } from "../../../lib/routes";
import {
  loadedScore,
  metadata,
  pending,
  scoreComponents,
  services,
  user,
} from "../../../../.storybook/fixtures/screens";
const meta = {
  title: "Screens/ScorePage",
  component: ScorePageView,
  parameters: {
    route: "/partituras/fixture-score",
    routePath: "/partituras/:scoreId/*",
  },
  args: {
    services,
    currentUser: user,
    collabEnabled: true,
    components: scoreComponents,
  },
} satisfies Meta<typeof ScorePageView>;
export default meta;
type Story = StoryObj<typeof ScorePageView>;

export const Review: Story = {};
export const Public: Story = {
  args: { currentUser: null },
  play: async ({ canvasElement }) => {
    const link = await within(canvasElement).findByRole("link", { name: loadedScore.projectTitle });
    await expect(link).toHaveAttribute("href", projectPath(loadedScore.projectId));
  },
};
export const Legacy: Story = { args: { collabEnabled: false } };
export const Loading: Story = {
  args: { services: { ...services, loadScore: () => pending() } },
};
export const Error: Story = {
  args: {
    services: {
      ...services,
      loadScore: () =>
        Promise.reject(new globalThis.Error("Partitura não encontrada")),
    },
  },
};
export const NoParts: Story = {
  args: {
    services: {
      ...services,
      loadScore: () =>
        Promise.resolve({ ...metadata, ...loadedScore, parts: [] }),
    },
  },
};
export const Arrangement: Story = {
  args: {
    services: {
      ...services,
      loadScore: () => Promise.resolve({
        ...loadedScore,
        arrangement: { svgUrls: loadedScore.parts[0].svgUrls },
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = await canvas.findByRole("button", { name: "Arranjo completo" });
    await expect(body.queryByRole("dialog", { name: "Arranjo completo" })).not.toBeInTheDocument();
    await userEvent.click(trigger);
    const dialog = await body.findByRole("dialog", { name: "Arranjo completo" });
    // The modal fades in: wait until it is shown.
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Imprimir arranjo" })).toBeVisible());
    await userEvent.click(within(dialog).getByRole("button", { name: "Fechar arranjo" }));
    await waitFor(() => expect(body.queryByRole("dialog", { name: "Arranjo completo" })).not.toBeInTheDocument());
  },
};

export const EditMetadata: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Editar metadados" }),
    );
    await waitFor(async () => {
      await expect(
        await within(document.body).findByRole("dialog"),
      ).toBeVisible();
    });
  },
};

export const Reviewer: Story = {
  args: {
    services: { ...services, getMemberRole: () => Promise.resolve("reviewer") },
  },
};
export const NoComments: Story = {
  args: { services: { ...services, getComments: () => Promise.resolve([]) } },
};
export const PickingComment: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Marcar ponto" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Clique na partitura…" }),
    ).toBeVisible();
  },
};
// A revision sent from the browser stores the MusicXML with the corrected instruments (025).
export const WithMusicXml: Story = {
  args: {
    currentUser: null,
    services: {
      ...services,
      loadScore: () =>
        Promise.resolve({ ...metadata, ...loadedScore, musicXmlUrl: "/fixtures/score.musicxml" }),
    },
  },
  play: async ({ canvasElement }) => {
    const link = await within(canvasElement).findByRole("link", { name: "Baixar MusicXML" });
    await expect(link).toHaveAttribute("download", `${loadedScore.title}.musicxml`);
  },
};
