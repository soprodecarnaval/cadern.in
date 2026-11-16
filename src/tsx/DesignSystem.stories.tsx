import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { DesignButton, DesignField, DesignModal as Modal } from "./DesignSystem";
import { expect, userEvent, within, waitFor } from "@storybook/test";
import "../css/BrandModal.css";
import "../css/DesignSystemSpecimen.css";

const colors = [
  ["Amarelo", "#fcee21"], ["Tinta", "#000000"],
  ["Papel", "#ffffff"], ["Superfície desabilitada", "#f2f2f2"],
  ["Texto secundário", "#555555"], ["Placeholder", "#6c6c6c"],
];

function ReferencePage() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
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
            <DesignButton onClick={() => setShow(true)}>Abrir exemplo</DesignButton>
            <DesignButton variant="secondary" onClick={() => setEmail("")}>Limpar campo</DesignButton>
            <DesignButton variant="text" onClick={() => setShow(true)}>Ver detalhes</DesignButton>
          </div>
          <div className="ds-reference-row">
            <DesignButton disabled>Indisponível</DesignButton>
            <DesignButton variant="secondary" disabled>Indisponível</DesignButton>
            <DesignButton disabled aria-busy="true">
              <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Salvando…
            </DesignButton>
          </div>
        </section>
        <section aria-labelledby="fields-title">
          <h2 id="fields-title">Campos e feedback</h2>
          <div className="ds-reference-fields">
            <div>
              <label className="form-label" htmlFor="ds-email">Email</label>
              <DesignField id="ds-email"  type="email" placeholder="voce@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div>
              <label className="form-label" htmlFor="ds-invalid">Email inválido</label>
              <DesignField id="ds-invalid" className="is-invalid" type="email" defaultValue="email-incompleto" aria-invalid="true" aria-describedby="ds-error" />
              <div id="ds-error" className="invalid-feedback">Confira o endereço de email.</div>
            </div>
            <div>
              <label className="form-label" htmlFor="ds-disabled">Desabilitado</label>
              <DesignField id="ds-disabled" value="Aguardando envio" disabled readOnly />
            </div>
          </div>
          <div className="alert alert-danger mt-3">Email ou senha inválidos. Confira os dados e tente novamente.</div>
          <div className="alert alert-success">Alterações salvas.</div>
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
            <DesignButton variant="text" onClick={() => setShow(true)}>Abrir modal de referência →</DesignButton>
          </article>
        </div>
        <p className="ds-reference-caption mt-3">Referência para revisão. Primitivos compartilhados com a home e a autenticação. Migração das demais telas em revisão.</p>
      </section>
      <Modal show={show} onHide={() => setShow(false)}>
        <Modal.Header closeButton><Modal.Title>Conta</Modal.Title></Modal.Header>
        <Modal.Body>
          <p>Exemplo de superfície, tipografia, campos e ações.</p>
          <label htmlFor="ds-modal-name" className="form-label">Nome</label>
          <DesignField id="ds-modal-name" placeholder="Como você quer ser chamado?" />
        </Modal.Body>
        <Modal.Footer className="gap-3">
          <DesignButton variant="text" onClick={() => setShow(false)}>Cancelar</DesignButton>
          <DesignButton onClick={() => setShow(false)}>Salvar</DesignButton>
        </Modal.Footer>
      </Modal>
    </main>
  );
}

const meta = {
  title: "Design System/Reference",
  component: ReferencePage,
  parameters: { fullScreen: true, layout: "fullscreen" },
} satisfies Meta<typeof ReferencePage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const email = canvas.getByRole("textbox", { name: "Email" });
    await userEvent.type(email, "designer@example.test");
    await expect(email).toHaveValue("designer@example.test");
    await userEvent.click(canvas.getByRole("button", { name: "Limpar campo" }));
    await expect(email).toHaveValue("");
    await userEvent.click(canvas.getByRole("button", { name: "Abrir exemplo" }));
    const dialog = await within(document.body).findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument());
  },
};


function ProjectBatchReference() {
  const [screen, setScreen] = useState("Projeto");
  const [name, setName] = useState("Bloco Exemplo");
  return (
    <main className="ds-reference ds-project-preview">
      <header>
        <p className="ds-reference-kicker">Proposta · lote 1 · navegação e projetos</p>
        <h1>Seus projetos no cadern.in</h1>
        <p>Mesmas ações e organização; tipografia, campos e botões compartilhados com a home e a conta.</p>
        <nav aria-label="Telas em revisão" className="ds-reference-row">
          {["Projetos", "Novo projeto", "Projeto", "Configurações"].map((label) => (
            <DesignButton key={label} variant={screen === label ? "primary" : "secondary"} aria-pressed={screen === label} onClick={() => setScreen(label)}>{label}</DesignButton>
          ))}
        </nav>
      </header>
      {screen === "Projetos" && <section>
        <h2>Meus projetos</h2>
        <article className="ds-reference-card">
          <h3>Bloco Exemplo</h3><p>Seu papel: proprietário</p>
          <DesignButton variant="text" onClick={() => setScreen("Projeto")}>Abrir projeto</DesignButton>
        </article>
      </section>}
      {screen === "Novo projeto" && <section>
        <h2>Criar projeto</h2>
        <label className="form-label" htmlFor="project-new-name">Nome do projeto</label>
        <DesignField id="project-new-name" placeholder="Nome do projeto" />
        <p className="ds-reference-caption mt-2">O endereço é gerado a partir do nome.</p>
        <DesignButton onClick={() => setScreen("Projeto")}>Criar projeto</DesignButton>
      </section>}
      {screen === "Projeto" && <>
        <section><h2>Bloco Exemplo</h2><p>Partituras e cadernos do projeto.</p><DesignButton variant="secondary" onClick={() => setScreen("Configurações")}>Configurações</DesignButton></section>
        <section><h2>Caderninhos</h2><div className="ds-reference-card"><h3>Carnaval 2026</h3><p>Publicado · 12 partituras</p><DesignButton variant="text">Abrir caderninho</DesignButton></div><DesignButton className="mt-3">+ Novo caderninho</DesignButton></section>
        <section><h2>Partituras</h2><div className="ds-reference-card"><h3>Abre Alas</h3><p>Chiquinha Gonzaga · versão 2</p><DesignButton variant="secondary">Enviar partitura</DesignButton></div></section>
      </>}
      {screen === "Configurações" && <section>
        <h2>Configurações do projeto</h2>
        <label className="form-label" htmlFor="project-name">Nome</label>
        <DesignField id="project-name" value={name} onChange={(event) => setName(event.target.value)} />
        <DesignButton className="my-3">Salvar</DesignButton>
        <h3>Convidar participante</h3>
        <label className="form-label" htmlFor="invite-email">Email</label>
        <DesignField id="invite-email" type="email" placeholder="voce@exemplo.com" />
        <DesignButton className="mt-3">Convidar</DesignButton>
      </section>}
      <p className="ds-reference-caption">Wireframe de revisão com dados fictícios. Ações de salvar, convidar e enviar são ilustrativas; não alteram dados. Permissões e estados de cada tela serão preservados na migração.</p>
    </main>
  );
}

export const ProjectBatch: Story = { render: () => <ProjectBatchReference /> };
