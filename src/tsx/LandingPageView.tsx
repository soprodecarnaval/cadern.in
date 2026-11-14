import { useMemo, useRef, useState, type ReactNode } from "react";
import { Accordion } from "react-bootstrap";
import { Link } from "react-router-dom";

import type { SongbookDoc } from "../../types/docs";
import type { WithId } from "../lib/db";
import type { CollectionContextValue } from "../useCollectionContext";

import arrowNext from "../assets/brand/arrow-next.svg";
import arrowPrev from "../assets/brand/arrow-prev.svg";
import chevronRight from "../assets/brand/chevron-right.svg";
import instagram from "../assets/brand/instagram.svg";
import logoWhite from "../assets/brand/logo-white.svg";
import logo from "../assets/brand/logo.svg";
import search from "../assets/brand/search.svg";
import "../css/LandingPage.css";

export type LandingArticle = {
  title: string;
  summary: string;
  href: string;
  imageUrl?: string;
};

/** A published songbook and, when it has one, a cover image to show. */
export type LandingSongbook = WithId<SongbookDoc> & { coverUrl?: string };

export type LandingSongbooks =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: LandingSongbook[] };

// Pages the design links to that don't exist yet. They fall through to the
// "not found" page until they're built.
const PLANNED = {
  sobre: "/sobre",
  contribua: "/contribua",
  ajuda: "/ajuda",
  biblioteca: "/biblioteca",
  artigos: "/artigos",
  carnaval: "/2027",
};

// Served as static HTML from /public, outside the router.
const STATIC = {
  plugin: "/plugin",
  instagram: "https://www.instagram.com/soprodecarnaval",
};

const MAX_SEARCH_RESULTS = 8;
const EXPORTER_ANCHOR = "exportador";

export function LandingPageView({
  currentUser,
  collabEnabled,
  inboxCount,
  collection,
  songbooks,
  articles,
  onOpenUserModal,
}: {
  currentUser: import("firebase/auth").User | null;
  collabEnabled: boolean;
  inboxCount: number;
  collection: CollectionContextValue;
  songbooks: LandingSongbooks;
  articles: LandingArticle[];
  onOpenUserModal: () => void;
}) {
  const [openTools, setOpenTools] = useState<string[]>(["plugin"]);
  // The exporter has no page of its own yet: links to it open its panel here.
  const showExporter = () => {
    setOpenTools((open) =>
      open.includes("exporter") ? open : [...open, "exporter"],
    );
    document
      .getElementById(EXPORTER_ANCHOR)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="landing">
      <LandingHeader
        currentUser={currentUser}
        collabEnabled={collabEnabled}
        inboxCount={inboxCount}
        onOpenUserModal={onOpenUserModal}
      />
      <main className="landing-main">
        <LandingSearch collection={collection} />

        <a className="landing-hero" href="/2026">
          <img
            src="/assets/home-hero.jpg"
            alt="Capa do caderninho do Carnaval BH 2026"
          />
        </a>

        <SongbookCarousel songbooks={songbooks} />
        <MoreLink to={PLANNED.biblioteca}>biblioteca</MoreLink>

        <section className="landing-section">
          <SectionTitle>Encontre ferramentas</SectionTitle>
          <Accordion
            className="landing-tools"
            activeKey={openTools}
            onSelect={(keys) =>
              setOpenTools(Array.isArray(keys) ? keys : keys ? [keys] : [])
            }
            alwaysOpen
          >
            <Accordion.Item eventKey="exporter" id={EXPORTER_ANCHOR}>
              <Accordion.Header>
                Baixe o Exportador cadern.in para desktop
              </Accordion.Header>
              <Accordion.Body>
                <p>
                  E faça upload de novas partituras para seus projetos no
                  cadern.in. Disponível para Windows, Mac e Linux.
                </p>
                <button type="button" className="landing-cta" disabled>
                  Em breve
                </button>
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="plugin">
              <Accordion.Header>
                Baixe a Extensão cadern.in para Musescore
              </Accordion.Header>
              <Accordion.Body>
                <p>
                  Formate suas partituras no padrão dos caderninhos direto no
                  Musescore, antes de enviá-las para o acervo.
                </p>
                <a className="landing-cta" href={STATIC.plugin}>
                  Baixar
                </a>
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>
        </section>

        <section className="landing-section">
          <SectionTitle>O que você vai fazer hoje?</SectionTitle>
          <div className="landing-actions">
            <ActionCard
              to={PLANNED.biblioteca}
              title="Explorar a biblioteca"
              text="Encontre, consulte e baixe caderninhos prontos."
            />
            <ActionCard
              to="/montar"
              title="Pesquisar músicas"
              text="Consulte, ouça, baixe ou estude partituras da nossa musicoteca."
            />
            <ActionCard
              to="/montar"
              title="Criar um novo caderninho"
              text="Crie um caderninho a partir das partituras existentes."
            />
            {collabEnabled &&
              (currentUser ? (
                <ActionCard
                  to="/projects"
                  title="Colaborar em um projeto"
                  text="Colabore com outros musicistas na criação e revisão de novas partituras ou cadernos."
                />
              ) : (
                <ActionCard
                  onClick={onOpenUserModal}
                  title="Colaborar em um projeto"
                  text="Colabore com outros musicistas na criação e revisão de novas partituras ou cadernos."
                />
              ))}
            <ActionCard
              to={PLANNED.contribua}
              title="Contribuir"
              text="Ajude o projeto cadern.in a colocar os blocos na rua!"
            />
          </div>
        </section>

        {articles.length > 0 && (
          <section className="landing-section">
            <SectionTitle>Artigos</SectionTitle>
            <div className="landing-articles">
              {articles.slice(0, 2).map((article) => (
                <Link
                  key={article.href}
                  className="landing-article"
                  to={article.href}
                >
                  <div className="landing-article-image">
                    {article.imageUrl && <img src={article.imageUrl} alt="" />}
                  </div>
                  <h3>{article.title}</h3>
                  <p>{article.summary}</p>
                </Link>
              ))}
            </div>
            <MoreLink to={PLANNED.artigos}>artigos</MoreLink>
          </section>
        )}
      </main>
      <LandingFooter
        currentUser={currentUser}
        collabEnabled={collabEnabled}
        onOpenUserModal={onOpenUserModal}
        onShowExporter={showExporter}
      />
    </div>
  );
}

function Logo({ inverted }: { inverted?: boolean }) {
  return (
    <Link to="/" className="landing-logo">
      <img src={inverted ? logoWhite : logo} alt="cadern.in" />
    </Link>
  );
}

function LandingHeader({
  currentUser,
  collabEnabled,
  inboxCount,
  onOpenUserModal,
}: {
  currentUser: import("firebase/auth").User | null;
  collabEnabled: boolean;
  inboxCount: number;
  onOpenUserModal: () => void;
}) {
  return (
    <header className="landing-header">
      <Logo />
      <nav className="landing-header-nav" aria-label="Principal">
        <Link to={PLANNED.sobre}>Sobre</Link>
        <Link to={PLANNED.contribua}>Contribua</Link>
        <Link to={PLANNED.ajuda}>Ajuda</Link>
        {collabEnabled && (
          <button
            type="button"
            className="landing-login"
            onClick={onOpenUserModal}
          >
            {currentUser
              ? (currentUser.displayName ?? "Minha conta")
              : "Entrar"}
            {currentUser && inboxCount > 0 && (
              <span
                className="landing-login-badge"
                aria-label={`${inboxCount} convites`}
              >
                {inboxCount}
              </span>
            )}
          </button>
        )}
      </nav>
    </header>
  );
}

function LandingSearch({ collection }: { collection: CollectionContextValue }) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const results = useMemo(
    () =>
      trimmed && collection.status === "ready"
        ? collection.search(trimmed).slice(0, MAX_SEARCH_RESULTS)
        : [],
    [trimmed, collection],
  );

  return (
    <div className="landing-search" role="search">
      <label className="landing-search-box">
        <img src={search} alt="" className="landing-search-icon" />
        <span className="visually-hidden">Pesquisar músicas</span>
        <input
          type="search"
          value={query}
          placeholder="Pesquise músicas, compositores, blocos…"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {trimmed && (
        <div className="landing-search-results">
          {collection.status === "loading" && <p>Carregando o acervo…</p>}
          {collection.status === "error" && (
            <p>Não foi possível carregar o acervo.</p>
          )}
          {collection.status === "ready" && results.length === 0 && (
            <p>Nenhuma música encontrada.</p>
          )}
          {results.length > 0 && (
            <ul>
              {results.map((score) => (
                <li key={score.id}>
                  <Link to={`/score/${encodeURIComponent(score.id)}`}>
                    <strong>{score.title}</strong>
                    <span>
                      {[score.composer, score.projectTitle]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SongbookCarousel({ songbooks }: { songbooks: LandingSongbooks }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (track) {
      track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
    }
  };

  if (songbooks.status === "error") {
    return (
      <p className="landing-carousel-message">
        Não foi possível carregar os cadernos.
      </p>
    );
  }
  if (songbooks.status === "ready" && songbooks.items.length === 0) {
    return (
      <p className="landing-carousel-message">
        Nenhum caderno publicado ainda.
      </p>
    );
  }

  return (
    <div className="landing-carousel" aria-label="Cadernos publicados">
      <div className="landing-carousel-track" ref={trackRef}>
        {songbooks.status === "loading"
          ? [0, 1, 2].map((i) => (
              <div key={i} className="landing-caderno is-loading" aria-hidden="true">
                <div className="landing-caderno-spiral" />
                <div className="landing-caderno-cover" />
              </div>
            ))
          : songbooks.items.map((songbook) => (
              <Link
                key={songbook.id}
                className="landing-caderno"
                to={`/projects/${encodeURIComponent(songbook.projectId)}/songbooks/${encodeURIComponent(songbook.slug)}`}
              >
                <div className="landing-caderno-spiral" />
                {songbook.coverUrl ? (
                  // With a cover, the title becomes a tooltip on hover.
                  <div className="landing-caderno-cover has-image">
                    <img src={songbook.coverUrl} alt="" />
                    <span className="landing-caderno-tooltip">
                      {songbook.title}
                    </span>
                  </div>
                ) : (
                  <div className="landing-caderno-cover">
                    <span className="landing-caderno-title">
                      {songbook.title}
                    </span>
                  </div>
                )}
              </Link>
            ))}
      </div>
      <button
        type="button"
        className="landing-carousel-button is-prev"
        aria-label="Cadernos anteriores"
        onClick={() => scroll(-1)}
      >
        <img src={arrowPrev} alt="" />
      </button>
      <button
        type="button"
        className="landing-carousel-button is-next"
        aria-label="Próximos cadernos"
        onClick={() => scroll(1)}
      >
        <img src={arrowNext} alt="" />
      </button>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="landing-section-title">{children}</h2>;
}

function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="landing-more">
      +{children}
    </Link>
  );
}

function ActionCard({
  title,
  text,
  ...target
}: {
  title: string;
  text: string;
} & ({ to: string } | { onClick: () => void })) {
  const className = "landing-action";
  const content = (
    <>
      <span className="landing-action-head">
        <h3>{title}</h3>
        <img src={chevronRight} alt="" className="landing-action-chevron" />
      </span>
      <p>{text}</p>
    </>
  );
  return "to" in target ? (
    <Link to={target.to} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" className={className} onClick={target.onClick}>
      {content}
    </button>
  );
}

function LandingFooter({
  currentUser,
  collabEnabled,
  onOpenUserModal,
  onShowExporter,
}: {
  currentUser: import("firebase/auth").User | null;
  collabEnabled: boolean;
  onOpenUserModal: () => void;
  onShowExporter: () => void;
}) {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <div className="landing-footer-brand">
          <Logo inverted />
          <a href={STATIC.instagram} className="landing-footer-social">
            <img src={instagram} alt="" />
            /soprodecarnaval
          </a>
        </div>
        <nav className="landing-footer-links" aria-label="Rodapé">
          <ul>
            <li><Link to={PLANNED.biblioteca}>Biblioteca</Link></li>
            <li><Link to="/montar">Musicoteca</Link></li>
            <li><Link to="/montar">Criar caderninho</Link></li>
            <li><a href={STATIC.plugin}>Plugin Musescore</a></li>
          </ul>
          <ul>
            {collabEnabled && (
              <>
                <li>
                  <button type="button" onClick={onOpenUserModal}>
                    Minha conta
                  </button>
                </li>
                <li>
                  {currentUser ? (
                    <Link to="/projects">Meus projetos</Link>
                  ) : (
                    <button type="button" onClick={onOpenUserModal}>
                      Meus projetos
                    </button>
                  )}
                </li>
              </>
            )}
            <li><Link to={PLANNED.carnaval}>Carnaval 2027</Link></li>
            <li>
              <a
                href={`#${EXPORTER_ANCHOR}`}
                onClick={(e) => {
                  e.preventDefault();
                  onShowExporter();
                }}
              >
                Exportador desktop
              </a>
            </li>
          </ul>
          <ul>
            <li><Link to={PLANNED.sobre}>Sobre</Link></li>
            <li><Link to={PLANNED.contribua}>Contribua</Link></li>
            <li><Link to={PLANNED.ajuda}>Ajuda</Link></li>
            <li><Link to={PLANNED.artigos}>Artigos</Link></li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
