import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within, waitFor } from "@storybook/test";
import { SongbookGenerationPanelView } from "./SongbookGenerationPanelView";
import { bookRevision, songbook, user, numberedItems } from "./screenFixtures";
import { coverPreviewFixture } from "./storyFixtures";

const imageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=";
const covers = {
  flauta: { path: "old-flauta.png", url: imageUrl },
  trompete: { path: "old-trompete.png", url: imageUrl },
};
const items = numberedItems.map((item) => item.type === "section" ? item : ({
  ...item,
  score: { ...item.score, latestRevision: { ...item.score.latestRevision, parts: [
    { ...item.score.latestRevision.parts[0], instrument: "flauta" as const },
    { ...item.score.latestRevision.parts[0], instrument: "trompete" as const },
  ] } },
}));
const generate = fn<typeof import("../lib/generateSongbookPdfs").generateSongbookPdfs>(() => Promise.resolve());
const saveCovers = fn<typeof import("../lib/songbookCovers").saveSongbookCovers>((input) => {
  const result = { ...input.current.covers };
  for (const instrument of input.removed) { delete result[instrument]; }
  for (const instrument of input.added.keys()) { result[instrument] = { path: "new-cover.png", url: imageUrl + "#saved" }; }
  return Promise.resolve(result);
});
const meta = {
  title: "Screens/SongbookGenerationPanel",
  component: SongbookGenerationPanelView,
  args: {
    currentUser: user,
    generateSongbookPdfs: generate,
    saveSongbookCovers: saveCovers,
    createCoverPreview: fn(coverPreviewFixture),
    songbook,
    revision: { ...bookRevision, covers },
    items,
    canEditCovers: true,
    onCoversSaved: fn(),
  },
} satisfies Meta<typeof SongbookGenerationPanelView>;
export default meta;
type Story = StoryObj<typeof SongbookGenerationPanelView>;

async function open(canvasElement: HTMLElement, instrument = "flauta") {
  await userEvent.click(within(canvasElement).getByRole("button", { name: `Capa de ${instrument}` }));
  const dialog = await within(document.body).findByRole("dialog");
  await waitFor(() => expect(dialog).toBeVisible());
  return within(dialog);
}
async function selectImage(dialog: Awaited<ReturnType<typeof open>>, type = "image/png") {
  const bytes = Uint8Array.from(atob(imageUrl.split(",")[1]), (char) => char.charCodeAt(0));
  const file = new File([bytes], type === "image/png" ? "nova-capa.png" : "nova-capa.jpg", { type });
  await userEvent.upload(dialog.getByLabelText("Selecionar imagem"), file);
  await waitFor(() => expect(dialog.getByRole("button", { name: "Salvar" })).toBeEnabled());
  return file;
}
async function closed() {
  await waitFor(() => expect(within(document.body).queryByRole("dialog")).toBeNull());
}

export const Ready: Story = {};
export const ExistingCover: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await expect(await dialog.findByTitle("Prévia da capa no PDF")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Salvar" })).toBeDisabled();
  },
};
export const NoCover: Story = {
  args: { revision: { ...bookRevision, covers: {} } },
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await expect(await dialog.findByTitle("Prévia da capa no PDF")).toBeVisible();
    await expect(dialog.getByText(/Nenhuma imagem salva/)).toBeVisible();
    await expect(dialog.queryByRole("button", { name: "Remover capa" })).toBeNull();
  },
};
export const ReplaceAndCancel: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    await selectImage(dialog);
    await userEvent.click(dialog.getByRole("button", { name: "Cancelar" }));
    await closed();
    await expect(args.saveSongbookCovers).not.toHaveBeenCalled();
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Gerar 2 caderninhos" }));
    await expect(args.generateSongbookPdfs).toHaveBeenCalledWith(expect.objectContaining({ covers: { flauta: imageUrl, trompete: imageUrl } }));
    const reopened = await open(canvasElement);
    await expect(reopened.getByText("Capa salva para este instrumento.")).toBeVisible();
  },
};
export const EscapeDiscardsDraft: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    await selectImage(dialog);
    await userEvent.keyboard("{Escape}");
    await closed();
    await expect(args.saveSongbookCovers).not.toHaveBeenCalled();
    const other = await open(canvasElement, "trompete");
    await expect(other.getByText("Capa salva para este instrumento.")).toBeVisible();
    await expect(other.queryByText("nova-capa.png")).toBeNull();
  },
};
export const CloseDiscardsDraft: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    await selectImage(dialog);
    await userEvent.click(dialog.getByRole("button", { name: "Close" }));
    await closed();
    await expect(args.saveSongbookCovers).not.toHaveBeenCalled();
  },
};
export const SaveImage: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    const file = await selectImage(dialog);
    await userEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await closed();
    await expect(args.saveSongbookCovers).toHaveBeenCalledTimes(1);
    await expect(args.saveSongbookCovers).toHaveBeenCalledWith(expect.objectContaining({ added: new Map([["flauta", file]]), removed: [], current: { ...bookRevision, covers } }));
    await expect(args.onCoversSaved).toHaveBeenCalledTimes(1);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Gerar 2 caderninhos" }));
    await expect(args.generateSongbookPdfs).toHaveBeenCalledWith(expect.objectContaining({ covers: { flauta: imageUrl + "#saved", trompete: imageUrl } }));
  },
};
export const SaveJpeg: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement, "trompete");
    const file = await selectImage(dialog, "image/jpeg");
    await userEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await closed();
    await expect(args.saveSongbookCovers).toHaveBeenCalledWith(expect.objectContaining({ added: new Map([["trompete", file]]), removed: [] }));
  },
};
export const SaveRemoval: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    await userEvent.click(dialog.getByRole("button", { name: "Remover capa" }));
    await waitFor(() => expect(dialog.getByRole("button", { name: "Salvar" })).toBeEnabled());
    await userEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await closed();
    await expect(args.saveSongbookCovers).toHaveBeenCalledWith(expect.objectContaining({ added: new Map(), removed: ["flauta"] }));
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Gerar 2 caderninhos" }));
    await expect(args.generateSongbookPdfs).toHaveBeenCalledWith(expect.objectContaining({ covers: { flauta: "", trompete: imageUrl } }));
  },
};
export const InvalidFile: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    const uploader = userEvent.setup({ applyAccept: false });
    await uploader.upload(dialog.getByLabelText("Selecionar imagem"), new File(["bad"], "cover.gif", { type: "image/gif" }));
    await expect(await dialog.findByText(/Selecione uma imagem PNG ou JPEG/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Salvar" })).toBeDisabled();
    await expect(args.saveSongbookCovers).not.toHaveBeenCalled();
  },
};
export const PreviewLoading: Story = {
  args: { createCoverPreview: () => new Promise<string>(() => undefined) },
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await expect(dialog.getByLabelText("Carregando prévia")).toBeVisible();
  },
};
export const PreviewRetry: Story = {
  args: { createCoverPreview: fn(coverPreviewFixture) },
  beforeEach: (context) => {
    context.args.createCoverPreview = fn(coverPreviewFixture).mockRejectedValueOnce(new Error("offline"));
  },
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await userEvent.click(await dialog.findByRole("button", { name: "Tentar novamente" }));
    await expect(await dialog.findByTitle("Prévia da capa no PDF")).toBeVisible();
  },
};
export const SaveFailureRetry: Story = {
  args: { saveSongbookCovers: fn(saveCovers) },
  beforeEach: (context) => {
    context.args.saveSongbookCovers = fn(saveCovers).mockRejectedValueOnce(new Error("Falha ao salvar. Tente novamente."));
  },
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    const file = await selectImage(dialog);
    await userEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await expect(await dialog.findByText("Falha ao salvar. Tente novamente.")).toBeVisible();
    await expect(dialog.getByText(file.name)).toBeVisible();
    await userEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await closed();
    await expect(args.saveSongbookCovers).toHaveBeenCalledTimes(2);
  },
};
export const Saving: Story = {
  args: { saveSongbookCovers: fn(() => new Promise<typeof covers>(() => undefined)) },
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    await selectImage(dialog);
    await userEvent.dblClick(dialog.getByRole("button", { name: "Salvar" }));
    await expect(await dialog.findByRole("button", { name: /Salvando/ })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    await expect(dialog.queryByRole("button", { name: "Close" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    await expect(within(document.body).getByRole("dialog")).toBeVisible();
    await expect(args.saveSongbookCovers).toHaveBeenCalledTimes(1);
  },
};
export const ReadOnly: Story = {
  args: { canEditCovers: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button", { name: /Capa de/ })).toBeNull();
  },
};
export const LoggedOut: Story = { args: { currentUser: null } };
