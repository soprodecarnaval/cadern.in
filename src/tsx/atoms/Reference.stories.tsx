import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
import { Checkbox, ChoiceGroup, Radio } from "./Choice";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { expect, fireEvent, userEvent, within, waitFor } from "@storybook/test";
import "./Reference.css";

const parts = ["Trompete", "Trombone", "Sax alto"];

const colors = [
  ["Amarelo", "#fcee21"], ["Tinta", "#000000"],
  ["Papel", "#ffffff"], ["Superfície desabilitada", "#f2f2f2"],
  ["Texto secundário", "#555555"], ["Placeholder", "#6c6c6c"],
];

function ReferencePage() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [chosenParts, setChosenParts] = useState<string[]>(["Trompete"]);
  const [staff, setStaff] = useState("auto");
  const allParts = chosenParts.length === parts.length;
  const someParts = chosenParts.length > 0 && !allParts;
  return (
    <main className="ds-reference">
      <header>
        <p className="ds-reference-kicker">cadern.in / sistema de design / proposta 01</p>
        <h1>A mesma linguagem, em toda a aplicação.</h1>
        <p>Referência baseada na home e na conta: Inter, amarelo, contornos pretos e superfícies claras.</p>
      </header>
      <section aria-labelledby="colors-title">
        <h2 id="colors-title">Cores</h2>
        <div className="ds-reference-swatches">
          {colors.map(([name, color]) => (
            <div key={name}>
              <div className="ds-reference-swatch" style={{ background: color }} />
              <strong>{name}</strong><br /><code>{color}</code>
            </div>
          ))}
        </div>
      </section>
      <section aria-labelledby="type-title">
        <h2 id="type-title">Tipografia e medidas</h2>
        <p className="ds-reference-heading">Títulos · Inter Bold · 24 / 30 px</p>
        <p className="ds-reference-medium">Ações e abas · Inter Medium · 18 px</p>
        <p>Texto · Inter Light · 18 px</p>
        <p className="ds-reference-caption">Texto auxiliar · 16 px</p>
        <p>Espaçamento: 4, 8, 12, 16, 24, 32 px. Contorno: 3 px. Raios: 8 px em botões, 12 px em campos, 14 px em modais.</p>
      </section>
      <div className="ds-reference-controls">
        <section aria-labelledby="buttons-title">
          <h2 id="buttons-title">Botões</h2>
          <p>Use o mouse para hover e Tab para foco. Ação primária amarela; secundária com contorno; ação textual sublinhada.</p>
          <div className="ds-reference-row">
            <Button onClick={() => setShow(true)}>Abrir exemplo</Button>
            <Button variant="secondary" onClick={() => setEmail("")}>Limpar campo</Button>
            <Button variant="text" onClick={() => setShow(true)}>Ver detalhes</Button>
          </div>
          <div className="ds-reference-row">
            <Button disabled>Indisponível</Button>
            <Button variant="secondary" disabled>Indisponível</Button>
            <Button disabled aria-busy="true">
              <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Salvando…
            </Button>
          </div>
        </section>
        <section aria-labelledby="fields-title">
          <h2 id="fields-title">Campos e feedback</h2>
          <p>Clique ou use Tab para foco: o campo sobe 3 px com sombra preta de 4 px, mantendo o fundo branco e o contorno preto.</p>
          <div className="ds-reference-fields">
            <div>
              <label className="form-label" htmlFor="ds-email">Email</label>
              <Input id="ds-email"  type="email" placeholder="voce@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div>
              <label className="form-label" htmlFor="ds-invalid">Email inválido</label>
              <Input id="ds-invalid" className="is-invalid" type="email" defaultValue="email-incompleto" aria-invalid="true" aria-describedby="ds-error" />
              <div id="ds-error" className="invalid-feedback">Confira o endereço de email.</div>
            </div>
            <div>
              <label className="form-label" htmlFor="ds-disabled">Desabilitado</label>
              <Input id="ds-disabled" value="Aguardando envio" disabled readOnly />
            </div>
          </div>
          <div className="alert alert-danger mt-3">Email ou senha inválidos. Confira os dados e tente novamente.</div>
          <div className="alert alert-success">Alterações salvas.</div>
        </section>
        <section aria-labelledby="choices-title">
          <h2 id="choices-title">Seleção</h2>
          <p>Caixas de seleção e opções: contorno preto de 3 px, preenchidas de amarelo quando marcadas, amarelas no hover. Com Tab, sobem 3 px com sombra preta, como os campos.</p>
          <div className="ds-reference-fields">
            <ChoiceGroup legend="Partes" hint="Marque as partes que quer imprimir.">
              <Checkbox
                label="Todas as partes"
                checked={allParts}
                indeterminate={someParts}
                onChange={() => setChosenParts(allParts ? [] : parts)}
              />
              {parts.map((part) => (
                <Checkbox
                  key={part}
                  label={part}
                  checked={chosenParts.includes(part)}
                  onChange={(event) =>
                    setChosenParts(
                      event.target.checked
                        ? [...chosenParts, part]
                        : chosenParts.filter((chosen) => chosen !== part),
                    )
                  }
                />
              ))}
            </ChoiceGroup>
            <ChoiceGroup legend="Tamanho da pauta" inline>
              <Radio name="ds-staff" value="auto" label="Automático" checked={staff === "auto"} onChange={() => setStaff("auto")} />
              <Radio name="ds-staff" value="fixed" label="Fixo" checked={staff === "fixed"} onChange={() => setStaff("fixed")} />
              <Radio name="ds-staff" value="custom" label="Personalizado" disabled />
            </ChoiceGroup>
            <ChoiceGroup legend="Estados">
              <Checkbox label="Desabilitada" disabled />
              <Checkbox label="Marcada e desabilitada" defaultChecked disabled />
              <Radio name="ds-disabled" label="Opção desabilitada" defaultChecked disabled />
            </ChoiceGroup>
            <ChoiceGroup legend="Direitos" error="Confirme para enviar a partitura.">
              <Checkbox label="Tenho os direitos desta partitura" aria-invalid="true" />
            </ChoiceGroup>
          </div>
        </section>
      </div>
      <section aria-labelledby="compositions-title">
        <h2 id="compositions-title">Composição</h2>
        <div className="ds-reference-compositions">
          <article className="ds-reference-card">
            <h3>Pesquisar músicas</h3>
            <p>Consulte, ouça, baixe ou estude partituras da nossa musicoteca.</p>
            <a href="/?path=/story/screens-landingpage--signed-out" target="_top">Revisar a home no Storybook →</a>
          </article>
          <article className="ds-reference-card">
            <h3>Conta</h3>
            <p>Campos, ações e feedback em uma superfície com título e fechamento.</p>
            <Button variant="text" onClick={() => setShow(true)}>Abrir modal de referência →</Button>
          </article>
        </div>
        <p className="ds-reference-caption mt-3">Referência para revisão. Primitivos compartilhados com a home e a autenticação. Migração das demais telas em revisão.</p>
      </section>
      <Modal show={show} onHide={() => setShow(false)}>
        <Modal.Header closeButton><Modal.Title>Conta</Modal.Title></Modal.Header>
        <Modal.Body>
          <p>Exemplo de superfície, tipografia, campos e ações.</p>
          <label htmlFor="ds-modal-name" className="form-label">Nome</label>
          <Input id="ds-modal-name" placeholder="Como você quer ser chamado?" />
        </Modal.Body>
        <Modal.Footer className="gap-3">
          <Button variant="text" onClick={() => setShow(false)}>Cancelar</Button>
          <Button onClick={() => setShow(false)}>Salvar</Button>
        </Modal.Footer>
      </Modal>
    </main>
  );
}

const meta = {
  title: "Atoms/Reference",
  component: ReferencePage,
  parameters: { fullScreen: true, layout: "fullscreen" },
} satisfies Meta<typeof ReferencePage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const email = canvas.getByRole("textbox", { name: "Email" });
    // userEvent.type's keystrokes on an email input change the text without
    // React seeing them, so the field's state stays empty; set it directly.
    await userEvent.click(email);
    await fireEvent.change(email, { target: { value: "designer@example.test" } });
    await expect(email).toHaveValue("designer@example.test");
    await userEvent.click(canvas.getByRole("button", { name: "Limpar campo" }));
    await expect(email).toHaveValue("");
    const all = canvas.getByRole("checkbox", { name: "Todas as partes" });
    await expect(all).toHaveProperty("indeterminate", true);
    await userEvent.click(all);
    await expect(all).toBeChecked();
    await expect(canvas.getByRole("checkbox", { name: "Sax alto" })).toBeChecked();
    await userEvent.click(canvas.getByRole("radio", { name: "Fixo" }));
    await expect(canvas.getByRole("radio", { name: "Fixo" })).toBeChecked();
    await expect(canvas.getByRole("radio", { name: "Automático" })).not.toBeChecked();
    await userEvent.click(canvas.getByRole("button", { name: "Abrir exemplo" }));
    const dialog = await within(document.body).findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument());
  },
};
