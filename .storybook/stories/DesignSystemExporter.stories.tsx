import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../../src/tsx/atoms/Button";
import { Input } from "../../src/tsx/atoms/Input";
import { Page } from "../../src/tsx/atoms/Page";
import { List } from "../../src/tsx/atoms/List";

type Mode = "ready" | "login" | "no-context" | "uploading" | "error";
function ExporterPreview({ mode }: { mode: Mode }) {
  const [busy, setBusy] = useState(false);
  const uploading = mode === "uploading" || busy;
  return (
    <Page className="py-4" style={{ maxWidth: 960 }}>
      <p className="text-muted">Proposta · lote 4 · exportador desktop</p>
      <h2>cadern.in — Exportador</h2>
      <p className="small text-muted">Wireframe com dados fictícios. Nenhum arquivo é exportado ou enviado.</p>
      {mode === "no-context" ? (
        <div className="alert alert-warning" role="alert">Abra o exportador pelo projeto ou pela página da partitura no caderninho para continuar.</div>
      ) : mode === "login" ? (
        <section>
          <h3>Entre na sua conta</h3>
          <label htmlFor="exporter-email" className="form-label">Email</label>
          <Input id="exporter-email" type="email" placeholder="voce@exemplo.com" />
          <label htmlFor="exporter-password" className="form-label mt-3">Senha</label>
          <Input id="exporter-password" type="password" placeholder="Senha" />
          <Button className="mt-3">Entrar</Button>
        </section>
      ) : (
        <>
          <section className="my-4">
            <h3>Destino</h3>
            <p>Bloco Exemplo / Carnaval 2026 / Abre Alas</p>
            <p className="text-muted small">Nova versão da partitura no contexto deste caderninho.</p>
          </section>
          <section className="mb-4">
            <h3>Arquivo e partes</h3>
            <List><List.Item>carnaval.mscz <span className="text-muted">· MuseScore 4</span></List.Item></List>
            <fieldset className="mt-3" disabled={uploading}>
              <legend className="fs-6">Partes para exportar</legend>
              {["Flauta", "Trompete", "Trombone"].map((part) => (
                <label key={part} className="d-block"><input type="checkbox" defaultChecked style={{ accentColor: "var(--ds-ink)" }} /> {part} <span className="small text-muted">· compatível</span></label>
              ))}
            </fieldset>
          </section>
          <section className="mb-4">
            <h3>Metadados</h3>
            <label htmlFor="exporter-title" className="form-label">Título</label>
            <Input id="exporter-title" defaultValue="Abre Alas" disabled={uploading} />
            <label htmlFor="exporter-composer" className="form-label mt-3">Compositor</label>
            <Input id="exporter-composer" defaultValue="Chiquinha Gonzaga" disabled={uploading} />
          </section>
          {mode === "error" && !uploading ? <div role="alert" className="alert alert-danger">Não foi possível enviar a partitura. Confira a conexão e tente novamente.</div> : null}
          {uploading ? <div role="status" className="mb-3">Exportando e enviando… Os controles ficam bloqueados durante a operação.</div> : null}
          <div className="d-flex gap-3">
            <Button disabled={uploading} aria-busy={uploading} onClick={() => setBusy(true)}>{uploading ? "Enviando…" : "Exportar e enviar"}</Button>
            <Button variant="secondary" disabled={uploading}>Trocar arquivo</Button>
          </div>
        </>
      )}
    </Page>
  );
}

const meta = {
  title: "Design System/Exporter batch",
  component: ExporterPreview,
  parameters: { fullScreen: true },
  args: { mode: "ready" },
} satisfies Meta<typeof ExporterPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Login: Story = { args: { mode: "login" } };
export const OpenFromWebsite: Story = { args: { mode: "no-context" } };
export const Uploading: Story = { args: { mode: "uploading" } };

export const Failure: Story = { args: { mode: "error" } };
