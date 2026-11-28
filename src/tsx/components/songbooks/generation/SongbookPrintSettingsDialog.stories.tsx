import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within, waitFor } from "@storybook/test";
import { createSongbookCoverPreview } from "../../../../lib/pdfPreview";
import type { NumberedSongbookScoreViewModel } from "../../../../../types/viewModels";
import type { Instrument } from "../../../../../types/instrument";
import { SongbookPrintSettingsDialogView, type SongbookPrintSettingsServices } from "./SongbookPrintSettingsDialogView";
import { bookRevision, songbook, user, numberedItems } from "../../../../../.storybook/fixtures/screens";
import { coverPreviewFixture } from "../../../../../.storybook/fixtures/components";

const imageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=";
const covers = {
  flauta: { path: "old-flauta.png", url: imageUrl },
  trompete: { path: "old-trompete.png", url: imageUrl },
};
// Two songs: one with a tuba part, one with trombone instead (039).
const base = numberedItems.find((item): item is NumberedSongbookScoreViewModel => item.type === "score")!;
const song = (id: string, index: number, instruments: Instrument[]): NumberedSongbookScoreViewModel => ({
  ...base,
  index,
  score: { ...base.score, id, latestRevision: { ...base.score.latestRevision, parts: instruments.map((instrument) => ({
    ...base.score.latestRevision.parts[0], instrument,
  })) } },
});
const items = [
  { type: "section" as const, title: "Sambas" },
  song("a", 1, ["flauta", "trompete", "tuba"]),
  song("b", 2, ["flauta", "trompete", "trombone"]),
];
const saveCovers = fn<typeof import("../../../../lib/songbookCovers").saveSongbookCovers>((input) => {
  const result = { ...input.current.covers };
  for (const instrument of input.removed) { delete result[instrument]; }
  for (const instrument of input.added.keys()) { result[instrument] = { path: "new-cover.png", url: imageUrl + "#saved" }; }
  return Promise.resolve(result);
});
const savePrint = fn<typeof import("../../../../lib/db").saveSongbookPrintSettings>(() => Promise.resolve("book-revision-3"));
const services = (overrides: Partial<SongbookPrintSettingsServices> = {}): SongbookPrintSettingsServices => ({
  saveSongbookPrintSettings: savePrint,
  saveSongbookCovers: saveCovers,
  createCoverPreview: fn(coverPreviewFixture),
  ...overrides,
});
const meta = {
  title: "Components/SongbookPrintSettingsDialog",
  component: SongbookPrintSettingsDialogView,
  args: {
    show: true,
    currentUser: user,
    services: services(),
    songbook,
    revision: { ...bookRevision, covers },
    items,
    onSaved: fn(),
    onHide: fn(),
  },
} satisfies Meta<typeof SongbookPrintSettingsDialogView>;
export default meta;
type Story = StoryObj<typeof SongbookPrintSettingsDialogView>;

const body = () => within(document.body);
async function settings() {
  const dialog = await body().findByRole("dialog", { name: "Configurações de impressão" });
  await waitFor(() => expect(dialog).toBeVisible());
  return within(dialog);
}
async function open(_canvasElement: HTMLElement, instrument = "flauta") {
  await userEvent.click((await settings()).getByRole("button", { name: `Capa de ${instrument}` }));
  const dialog = await body().findByRole("dialog", { name: /^Capa ·/ });
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
// The cover's dialog has closed and the settings are back.
async function closed() {
  await waitFor(() => expect(body().queryByRole("dialog", { name: /^Capa ·/ })).toBeNull());
  return settings();
}

export const Ready: Story = {
  play: async () => {
    const dialog = await settings();
    // Nothing to print from here, and nothing to save until something changes.
    await expect(dialog.queryByRole("button", { name: /Gerar/ })).toBeNull();
    await expect(dialog.getByRole("button", { name: "Salvar" })).toBeDisabled();
    await expect(dialog.getByRole("checkbox", { name: "Usar trombone nas músicas sem tuba (+1)" })).not.toBeChecked();
  },
};
export const SaveSettings: Story = {
  play: async ({ args }) => {
    const dialog = await settings();
    // Tuba eb and bombardino get the same offer; only tuba is turned on.
    await expect(dialog.getByRole("checkbox", { name: "Usar trombone nas músicas sem bombardino (+1)" })).toBeVisible();
    await userEvent.click(dialog.getByRole("checkbox", { name: "Usar trombone nas músicas sem tuba (+1)" }));
    await userEvent.click(dialog.getByRole("checkbox", { name: "Cartilha anti-assédio" }));
    await userEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await expect(args.services.saveSongbookPrintSettings).toHaveBeenCalledWith(
      songbook,
      { fallbacks: ["tuba"], backSheetPageNumber: false, antiAssedioPages: true },
      user.uid,
    );
    await waitFor(() => expect(args.onSaved).toHaveBeenCalled());
    await expect(args.onHide).toHaveBeenCalled();
  },
};
export const SavedSettings: Story = {
  args: { revision: { ...bookRevision, covers, print: { fallbacks: ["tuba"], backSheetPageNumber: true, antiAssedioPages: false } } },
  play: async () => {
    const dialog = await settings();
    await expect(dialog.getByRole("checkbox", { name: "Usar trombone nas músicas sem tuba (+1)" })).toBeChecked();
    await expect(dialog.getByRole("checkbox", { name: "Página de número no verso" })).toBeChecked();
    // Turning a setting back on and off again leaves nothing to save.
    await userEvent.click(dialog.getByRole("checkbox", { name: "Página de número no verso" }));
    await expect(dialog.getByRole("button", { name: "Salvar" })).toBeEnabled();
    await userEvent.click(dialog.getByRole("checkbox", { name: "Página de número no verso" }));
    await expect(dialog.getByRole("button", { name: "Salvar" })).toBeDisabled();
  },
};
export const CancelDiscards: Story = {
  play: async ({ args }) => {
    const dialog = await settings();
    await userEvent.click(dialog.getByRole("checkbox", { name: "Página de número no verso" }));
    await userEvent.click(dialog.getByRole("button", { name: "Cancelar" }));
    await expect(args.onHide).toHaveBeenCalled();
    await expect(args.services.saveSongbookPrintSettings).not.toHaveBeenCalled();
  },
};
export const SaveFailure: Story = {
  args: {
    services: services({
      saveSongbookPrintSettings: () => Promise.reject(new Error("Não foi possível ler a versão atual. Tente novamente.")),
    }),
  },
  play: async ({ args }) => {
    const dialog = await settings();
    await userEvent.click(dialog.getByRole("checkbox", { name: "Cartilha anti-assédio" }));
    await userEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await expect(await dialog.findByRole("alert")).toHaveTextContent("Não foi possível ler a versão atual.");
    await expect(dialog.getByRole("checkbox", { name: "Cartilha anti-assédio" })).toBeChecked();
    await expect(args.onHide).not.toHaveBeenCalled();
  },
};
export const SavingSettings: Story = {
  args: {
    services: services({ saveSongbookPrintSettings: () => new Promise<string>(() => undefined) }),
  },
  play: async () => {
    const dialog = await settings();
    await userEvent.click(dialog.getByRole("checkbox", { name: "Cartilha anti-assédio" }));
    await userEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await expect(await dialog.findByRole("button", { name: /Salvando/ })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  },
};
export const KeepsDraftAcrossCover: Story = {
  play: async ({ canvasElement }) => {
    const before = await settings();
    await userEvent.click(before.getByRole("checkbox", { name: "Página de número no verso" }));
    const cover = await open(canvasElement);
    await userEvent.click(cover.getByRole("button", { name: "Cancelar" }));
    const after = await closed();
    await expect(after.getByRole("checkbox", { name: "Página de número no verso" })).toBeChecked();
  },
};

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
    await expect(args.services.saveSongbookCovers).not.toHaveBeenCalled();
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
    await expect(args.services.saveSongbookCovers).not.toHaveBeenCalled();
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
    await expect(args.services.saveSongbookCovers).not.toHaveBeenCalled();
  },
};
export const SaveImage: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    const file = await selectImage(dialog);
    await userEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await closed();
    await expect(args.services.saveSongbookCovers).toHaveBeenCalledTimes(1);
    await expect(args.services.saveSongbookCovers).toHaveBeenCalledWith(expect.objectContaining({ added: new Map([["flauta", file]]), removed: [], current: { ...bookRevision, covers } }));
    await expect(args.onSaved).toHaveBeenCalledTimes(1);
  },
};
export const SaveJpeg: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement, "trompete");
    const file = await selectImage(dialog, "image/jpeg");
    await userEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await closed();
    await expect(args.services.saveSongbookCovers).toHaveBeenCalledWith(expect.objectContaining({ added: new Map([["trompete", file]]), removed: [] }));
  },
};
export const SaveRemoval: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    await userEvent.click(dialog.getByRole("button", { name: "Remover capa" }));
    await waitFor(() => expect(dialog.getByRole("button", { name: "Salvar" })).toBeEnabled());
    await userEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await closed();
    await expect(args.services.saveSongbookCovers).toHaveBeenCalledWith(expect.objectContaining({ added: new Map(), removed: ["flauta"] }));
    // Back in the settings, flauta has no cover any more.
    await expect((await settings()).getByRole("button", { name: "Capa de flauta" })).toHaveTextContent(/^Capa$/);
  },
};
export const InvalidFile: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    const uploader = userEvent.setup({ applyAccept: false });
    await uploader.upload(dialog.getByLabelText("Selecionar imagem"), new File(["bad"], "cover.gif", { type: "image/gif" }));
    await expect(await dialog.findByText(/Selecione uma imagem PNG ou JPEG/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Salvar" })).toBeDisabled();
    await expect(args.services.saveSongbookCovers).not.toHaveBeenCalled();
  },
};
export const PreviewLoading: Story = {
  args: { services: services({ createCoverPreview: () => new Promise<string>(() => undefined) }) },
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await expect(dialog.getByLabelText("Carregando prévia")).toBeVisible();
  },
};
export const PreviewRetry: Story = {
  beforeEach: (context) => {
    context.args.services = services({ createCoverPreview: fn(coverPreviewFixture).mockRejectedValueOnce(new Error("offline")) });
  },
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await userEvent.click(await dialog.findByRole("button", { name: "Tentar novamente" }));
    await expect(await dialog.findByTitle("Prévia da capa no PDF")).toBeVisible();
  },
};
export const SaveFailureRetry: Story = {
  beforeEach: (context) => {
    context.args.services = services({ saveSongbookCovers: fn(saveCovers).mockRejectedValueOnce(new Error("Falha ao salvar. Tente novamente.")) });
  },
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    const file = await selectImage(dialog);
    await userEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await expect(await dialog.findByText("Falha ao salvar. Tente novamente.")).toBeVisible();
    await expect(dialog.getByText(file.name)).toBeVisible();
    await userEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await closed();
    await expect(args.services.saveSongbookCovers).toHaveBeenCalledTimes(2);
  },
};
export const Saving: Story = {
  args: { services: services({ saveSongbookCovers: fn(() => new Promise<typeof covers>(() => undefined)) }) },
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    await selectImage(dialog);
    await userEvent.dblClick(dialog.getByRole("button", { name: "Salvar" }));
    await expect(await dialog.findByRole("button", { name: /Salvando/ })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    await expect(dialog.queryByRole("button", { name: "Close" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    await expect(body().getByRole("dialog", { name: /^Capa ·/ })).toBeVisible();
    await expect(args.services.saveSongbookCovers).toHaveBeenCalledTimes(1);
  },
};
export const LoggedOut: Story = {
  args: { currentUser: null },
  play: async () => {
    const dialog = await settings();
    await expect(dialog.queryByRole("button", { name: /Capa de/ })).toBeNull();
    await expect(dialog.getByRole("button", { name: "Salvar" })).toBeDisabled();
  },
};

export const InferredCover: Story = {
  args: { services: services({ createCoverPreview: createSongbookCoverPreview }), revision: { ...bookRevision, covers: {} } },
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await expect(await dialog.findByTitle("Prévia da capa no PDF")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Salvar" })).toBeDisabled();
  },
};
