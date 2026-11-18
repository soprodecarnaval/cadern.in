import type { User } from "firebase/auth";
import type { ReactNode } from "react";
import { Accordion } from "react-bootstrap";
import { Link } from "react-router-dom";

import { ROUTE_PATTERNS, aboutPath, contributePath } from "../../../lib/routes";
import { LandingFooter, LandingHeader } from "../landing/LandingPageView";
import type { ProfileTab } from "../account/ProfileModalView";

import "../landing/LandingPage.css";
import "./HelpPage.css";

// Served as static HTML from /public, outside the router.
const PLUGIN_PATH = "/plugin";

type Question = { id: string; question: string; answer: ReactNode };

const QUESTIONS: Question[] = [
  {
    id: "o-que-e",
    question: "O que é o cadern.in?",
    answer: (
      <p>
        Um acervo de partituras criado por musicistas do carnaval de Belo
        Horizonte, de forma voluntária e sem fins lucrativos.
      </p>
    ),
  },
  {
    id: "pesquisar",
    question: "Como encontro uma música?",
    answer: (
      <p>
        Use a busca no topo da <Link to={ROUTE_PATTERNS.home}>página inicial</Link>
        . Pesquise pelo nome da música e abra a partitura para consultar,
        ouvir ou baixar.
      </p>
    ),
  },
  {
    id: "montar",
    question: "Como monto o meu caderninho?",
    answer: (
      <p>
        Em <Link to={ROUTE_PATTERNS.builder}>Criar caderninho</Link>, pesquise
        as músicas e adicione cada uma com o botão +. Depois organize o
        caderninho em seções e arraste as músicas para mudar a ordem.
      </p>
    ),
  },
  {
    id: "colaborar",
    question: "Posso colaborar em um projeto?",
    answer: (
      <p>
        Sim. Criando uma conta no cadern.in você pode criar seus próprios
        projetos ou ser convidado para colaborar com outros musicistas na
        criação e revisão de partituras e caderninhos.
      </p>
    ),
  },
  {
    id: "musescore",
    question: "Como formato minhas partituras no padrão dos caderninhos?",
    answer: (
      <p>
        Baixe a <a href={PLUGIN_PATH}>Extensão cadern.in para Musescore</a>.
        Ela formata as partituras direto no Musescore, antes de você enviá-las
        para o acervo.
      </p>
    ),
  },
  {
    id: "contribuir",
    question: "Como posso ajudar o projeto?",
    answer: (
      <p>
        Você pode contribuir com um PIX para a produção dos caderninhos. Veja
        como na página <Link to={contributePath()}>Contribua</Link>.
      </p>
    ),
  },
  {
    id: "contato",
    question: "Não encontrei a minha dúvida",
    answer: (
      <p>
        Escreva para a gente pelo formulário Fale conosco, na página{" "}
        <Link to={aboutPath()}>Sobre</Link>.
      </p>
    ),
  },
];

/** Frequent questions about cadern.in, in the home page's accordion style. */
export function HelpPageView({
  currentUser,
  collabEnabled,
  inboxCount,
  onOpenUserModal,
  onSignOut,
}: {
  currentUser: User | null;
  collabEnabled: boolean;
  inboxCount: number;
  onOpenUserModal: (tab?: ProfileTab) => void;
  onSignOut: () => void;
}) {
  return (
    <div className="landing">
      <LandingHeader
        currentUser={currentUser}
        collabEnabled={collabEnabled}
        inboxCount={inboxCount}
        onOpenUserModal={onOpenUserModal}
        onSignOut={onSignOut}
      />
      <main className="landing-main">
        <div className="help">
          <h1 className="landing-section-title">Ajuda</h1>
          <p className="help-intro">
            Respostas para as dúvidas mais comuns sobre o cadern.in.
          </p>
          <Accordion className="landing-tools help-questions" alwaysOpen>
            {QUESTIONS.map(({ id, question, answer }) => (
              <Accordion.Item key={id} eventKey={id} id={id}>
                <Accordion.Header as="h2">{question}</Accordion.Header>
                <Accordion.Body>{answer}</Accordion.Body>
              </Accordion.Item>
            ))}
          </Accordion>
        </div>
      </main>
      <LandingFooter
        currentUser={currentUser}
        collabEnabled={collabEnabled}
        onOpenUserModal={onOpenUserModal}
      />
    </div>
  );
}
