import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { DEFAULT_FORMATTING_PROFILE } from "../../../../types/formattingProfile";
import { initialState, partRows, type EnviarState } from "./enviarState";
import { EnviarPageView } from "./EnviarPageView";

const rows = partRows([
  { ordinal: 1, name: "Flauta", instruments: [{ id: "flute", soundId: "wind.flutes.flute", longName: "Flauta", shortName: "Fl." }] },
  { ordinal: 2, name: "Pete", instruments: [{ id: "bb-trumpet", soundId: "brass.trumpet.bflat", longName: "Trompete B♭", shortName: "Tpt." }] },
  { ordinal: 3, name: "Tuba", instruments: [{ id: "bb-tuba", soundId: "brass.tuba", longName: "Tuba B♭", shortName: "Tba." }] },
  { ordinal: 4, name: "Órgão", instruments: [{ id: "pipe-organ", soundId: "keyboard.organ.pipe", longName: "Órgão", shortName: "Org." }] },
]);
// A stand-in for an engraved page: five staff lines per system.
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 171.7 98.2">${[10, 35, 60].map((y) =>
  [0, 2, 4, 6, 8].map((d) => `<line x1="2" x2="170" y1="${y + d}" y2="${y + d}" stroke="black" stroke-width="0.2"/>`).join("")).join("")}</svg>`;
const preview = (ordinal: number, extra = {}, fingeringScale = 0.9) => ({
  ordinal, svg: sheet, pages: 1, layout: { staffSpaceMm: 1.45, systems: 3, fillRatio: 0.82, fingeringScale },
  automaticFingeringSize: fingeringScale, warnings: [], rendering: false, ...extra,
});
const base: EnviarState = { ...initialState(), fileName: "Cilada.mscz", metadata: { title: "CILADA", composer: "Tim Maia", sub: "", tags: ["marcha"] }, rows };
const state = (change: Partial<EnviarState>): EnviarState => ({ ...base, ...change });

const meta = {
  title: "Screens/EnviarPage",
  component: EnviarPageView,
  args: {
    state: initialState(),
    context: { projectId: "bloco-exemplo" },
    signedIn: true,
    components: { MidiPlayer: ({ src }: { src: string }) => <p>MIDI: {src}</p> },
    onFile: fn(), onStep: fn(), onRows: fn(), onProfile: fn(), onMetadata: fn(), onEditing: fn(), onListen: fn(),
    onSend: fn(), onCancel: fn(), onDismissError: fn(), onReset: fn(),
  },
} satisfies Meta<typeof EnviarPageView>;
export default meta;
type Story = StoryObj<typeof EnviarPageView>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Arraste o arquivo .mscz para cá")).toBeVisible();
    await expect(canvas.getByText(/até 32 MB/)).toBeVisible();
  },
};

export const LoadingEngine: Story = {
  args: { state: state({ status: { kind: "loading-engine" } }) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Baixando o motor de partituras");
  },
};

export const Parts: Story = {
  args: { state: state({ step: "partes" }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("Instrumento de Pete")).toHaveValue("trompete pirata");
    await expect(canvas.getByLabelText("Enviar Órgão")).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Continuar" })).toBeEnabled();
  },
};

export const Data: Story = {
  args: { state: state({ step: "dados" }) },
  render: function Render(args) {
    const [metadata, setMetadata] = useState(args.state.metadata);
    return <EnviarPageView {...args} state={{ ...args.state, metadata }} onMetadata={(next) => { setMetadata(next); args.onMetadata(next); }} />;
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("listitem", { current: "step" })).toHaveTextContent("Dados");
    await expect(canvas.getByLabelText("Título")).toHaveValue("CILADA");
    await expect(canvas.getByLabelText("Compositor")).toHaveValue("Tim Maia");
    await expect(canvas.getByLabelText("Tags")).toHaveValue("marcha");
    await userEvent.type(canvas.getByLabelText("Tags"), ", frevo,");
    await expect(canvas.getByLabelText("Tags")).toHaveValue("marcha, frevo,");
    await expect(args.onMetadata).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ["marcha", "frevo"] }));
    await userEvent.clear(canvas.getByLabelText("Título"));
    await expect(canvas.getByRole("alert")).toHaveTextContent("Dê um título à partitura.");
    await expect(canvas.getByRole("button", { name: "Formatar 3 partes" })).toBeDisabled();
    await userEvent.type(canvas.getByLabelText("Título"), "Cilada");
    await userEvent.click(canvas.getByRole("button", { name: "Formatar 3 partes" }));
    await expect(args.onStep).toHaveBeenLastCalledWith("formatacao");
  },
};

export const Formatting: Story = {
  args: {
    state: state({
      step: "formatacao",
      profile: DEFAULT_FORMATTING_PROFILE,
      previews: {
        1: preview(1),
        2: preview(2, { rendering: true }),
        3: preview(3, { pages: 2, warnings: [{ code: "SHEET_OVERFLOW", message: "" }] }),
      },
    }),
  },
  render: function Render(args) {
    const [editing, setEditing] = useState(args.state.editing);
    return <EnviarPageView {...args} state={{ ...args.state, editing }} onEditing={setEditing} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("region", { name: "Toda a partitura" })).toBeNull();
    // One part at a time, in tabs; the tuba's tab is marked for its warning.
    await expect(canvas.getAllByRole("tab")).toHaveLength(3);
    await expect(canvas.getByRole("tab", { name: "Flauta" })).toHaveAttribute("aria-selected", "true");
    const part = within(canvas.getByRole("region", { name: "Parte: Flauta" }));
    await expect(part.getByRole("spinbutton", { name: "Tamanho da pauta (mm)" })).toHaveValue(1.45);
    await expect(canvas.getAllByText(/Pauta de 1,45 mm/)).toHaveLength(1);
    await userEvent.click(canvas.getByRole("tab", { name: /Tuba/ }));
    await expect(canvas.getByRole("region", { name: "Parte: Tuba" })).toBeVisible();
    await expect(canvas.getByText(/Não coube em uma página/)).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: /Pete/ }));
    await expect(within(canvas.getByRole("region", { name: "Parte: Pete" })).getByRole("radio", { name: "Posições (1–7)" })).toBeChecked();
    await expect(canvas.getByText("Atualizando…")).toBeVisible();
  },
};

export const FingeringSize: Story = {
  args: {
    state: state({
      step: "formatacao",
      previews: { 1: preview(1), 2: preview(2, {}, 0.75), 3: preview(3, {}, 0.9) },
    }),
  },
  render: function Render(args) {
    const [profile, setProfile] = useState(args.state.profile);
    const [editing, setEditing] = useState(args.state.editing);
    return <EnviarPageView {...args} state={{ ...args.state, profile, editing }} onProfile={setProfile} onEditing={setEditing} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const size = () => canvas.getByRole("spinbutton", { name: "Tamanho dos números" });
    const mode = (name: string) => within(canvas.getByRole("group", { name: "Tamanho dos números" })).getByRole("radio", { name });
    const adjust = (direction: "Aumentar" | "Diminuir") => canvas.getByRole("button", { name: `${direction}: Tamanho dos números` });

    await expect(canvas.queryByRole("spinbutton", { name: "Tamanho dos números" })).toBeNull();
    await userEvent.click(canvas.getByRole("tab", { name: "Pete" }));
    await expect(mode("Automático")).toBeChecked();
    await expect(size()).toHaveValue(0.75);
    await userEvent.click(adjust("Aumentar"));
    await expect(mode("Fixo")).toBeChecked();
    await expect(size()).toHaveValue(0.8);

    await userEvent.click(canvas.getByRole("tab", { name: "Tuba" }));
    await expect(mode("Automático")).toBeChecked();
    await expect(size()).toHaveValue(0.9);
    await userEvent.click(adjust("Diminuir"));
    await expect(size()).toHaveValue(0.85);

    await userEvent.click(canvas.getByRole("tab", { name: "Pete" }));
    await expect(size()).toHaveValue(0.8);
    await userEvent.click(mode("Automático"));
    await expect(size()).toHaveValue(0.75);
    await expect(size()).toHaveAttribute("readonly");

    await userEvent.click(canvas.getByRole("tab", { name: "Tuba" }));
    await expect(mode("Fixo")).toBeChecked();
    await expect(size()).toHaveValue(0.85);
  },
};

export const Uploading: Story = {
  args: {
    state: state({
      step: "enviar",
      status: { kind: "uploading", progress: { stage: "uploading", filesUploaded: 4, filesTotal: 9 } },
      target: { kind: "version", scoreId: "bloco-exemplo-cilada", title: "Cilada" },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Nova versão de “Cilada”")).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent("Enviando arquivos (4 de 9)");
    await expect(canvas.getByRole("button", { name: "Enviando…" })).toBeDisabled();
  },
};

export const Done: Story = {
  args: {
    state: state({
      step: "feito",
      result: { identity: { scoreId: "bloco-exemplo-cilada", revisionId: "cilada-1" }, target: { kind: "new", scoreId: "bloco-exemplo-cilada" }, repin: "updated" },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("O caderninho passou a usar esta versão.")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Ver a partitura" })).toHaveAttribute("href", "/partituras/bloco-exemplo-cilada/versoes/cilada-1");
  },
};

export const Error: Story = {
  args: {
    state: state({
      step: "enviar",
      status: { kind: "error", message: "Esta partitura foi atualizada por outra pessoa desde que este link foi gerado." },
    }),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("atualizada por outra pessoa");
  },
};
