import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { EXPORTER_RELEASE } from "../../../lib/exporterRelease";
import { ExporterPageView } from "./ExporterPageView";

const meta = {
  title: "Screens/ExporterPage",
  component: ExporterPageView,
  parameters: {
    route: "/bloco-exemplo/exportador",
    routePath: "/:slug/exportador",
  },
  args: {
    context: { projectId: "bloco-exemplo" },
    copy: fn(() => Promise.resolve()),
  },
} satisfies Meta<typeof ExporterPageView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new score for the project: the downloads, then open or copy the link. */
export const NewScore: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    for (const download of EXPORTER_RELEASE.downloads) {
      await expect(canvas.getByRole("link", { name: `Baixar para ${download.system}` }))
        .toHaveAttribute("href", download.url);
    }
    const link = "cadernin-export://upload?projectId=bloco-exemplo";
    await expect(canvas.getByRole("link", { name: "Abrir no Exportador" })).toHaveAttribute("href", link);
    await expect(canvas.getByRole("textbox", { name: "Link do envio" })).toHaveValue(link);
    await userEvent.click(canvas.getByRole("button", { name: "Copiar link" }));
    await expect(args.copy).toHaveBeenCalledWith(link);
    await expect(await canvas.findByText("Link copiado.")).toBeVisible();
  },
};

/** A new version of a score: the link names it. */
export const NewVersion: Story = {
  args: {
    context: { projectId: "bloco-exemplo", scoreId: "score-1", expectedScoreRevisionId: "rev-2" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Abrir no Exportador" })).toHaveAttribute(
      "href",
      "cadernin-export://upload?projectId=bloco-exemplo&scoreId=score-1&expectedScoreRevisionId=rev-2",
    );
    await expect(canvas.getByText(/como nova versão da partitura/)).toBeVisible();
  },
};

/** The browser refused the clipboard: say so, the field is still there. */
export const CopyFailed: Story = {
  args: { copy: fn(() => Promise.reject(new Error("denied"))) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Copiar link" }));
    await expect(await canvas.findByText("Não foi possível copiar. Selecione o link e copie.")).toBeVisible();
  },
};

/** From the footer, with no project: the downloads only. */
export const DownloadOnly: Story = {
  parameters: { route: "/exportador", routePath: "/exportador" },
  args: { context: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Baixar para Mac" })).toBeVisible();
    await expect(canvas.queryByRole("link", { name: "Abrir no Exportador" })).toBeNull();
    await expect(canvas.getByText(/abra o Exportador pela página de envio de um projeto/)).toBeVisible();
  },
};
