import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { HomePageView } from "../../src/tsx/screens/builder/HomePageView";
import { collection, homeComponents, storage, user } from "../fixtures/screens";
import { Button } from "../../src/tsx/atoms/Button";
import { Input } from "../../src/tsx/atoms/Input";
import { Modal } from "../../src/tsx/atoms/Modal";
import { Page } from "../../src/tsx/atoms/Page";

function BuilderPreview() {
  return (
    <Page className="py-4">
      <p className="text-muted">Proposta · lote 2 · construtor e controles compartilhados</p>
      <HomePageView
        currentUser={user}
        collection={collection}
        storage={storage}
        collabEnabled
        components={homeComponents}
        onRequestLogin={() => undefined}
      />
    </Page>
  );
}

function DialogPreview() {
  const [show, setShow] = useState(true);
  const [kind, setKind] = useState("Salvar caderninho");
  return (
    <Page className="py-4">
      <h2>Diálogos · proposta do lote 2</h2>
      <p>Superfície e controles para salvar, exportar e editar metadados. Sem alterações em dados ou geração de arquivos.</p>
      <div className="d-flex gap-3">
        {["Salvar caderninho", "Gerar caderninhos", "Editar metadados"].map((title) => (
          <Button key={title} variant="secondary" onClick={() => { setKind(title); setShow(true); }}>{title}</Button>
        ))}
      </div>
      <Modal show={show} onHide={() => setShow(false)}>
        <Modal.Header closeButton><Modal.Title>{kind}</Modal.Title></Modal.Header>
        <Modal.Body>
          <label className="form-label" htmlFor="batch2-title">Título</label>
          <Input id="batch2-title" defaultValue="Carnaval 2026" />
          {kind === "Gerar caderninhos" ? (
            <fieldset className="mt-3">
              <legend className="fs-6">Instrumentos</legend>
              <label><input type="checkbox" defaultChecked /> Trompete</label>
              <br /><label><input type="checkbox" defaultChecked /> Trombone</label>
              <p className="small text-muted mt-2">Seleção e progresso preservam o fluxo atual.</p>
            </fieldset>
          ) : (
            <>
              <label className="form-label mt-3" htmlFor="batch2-detail">{kind === "Salvar caderninho" ? "Projeto" : "Compositor"}</label>
              <Input id="batch2-detail" defaultValue={kind === "Salvar caderninho" ? "Bloco Exemplo" : "Chiquinha Gonzaga"} />
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="gap-3">
          <Button variant="text" onClick={() => setShow(false)}>Cancelar</Button>
          <Button onClick={() => setShow(false)}>{kind === "Gerar caderninhos" ? "Gerar" : "Salvar"}</Button>
        </Modal.Footer>
      </Modal>
    </Page>
  );
}

const meta = {
  title: "Design System/Builder batch",
  component: BuilderPreview,
  parameters: { fullScreen: true, route: "/montar", routePath: "/montar" },
} satisfies Meta<typeof BuilderPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Builder: Story = {};
export const Dialogs: Story = { render: () => <DialogPreview /> };
