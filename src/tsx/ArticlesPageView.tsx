import type { User } from "firebase/auth";
import { useMemo, useState, type ReactNode } from "react";

import type { ArticleCard } from "../articles";
import { ArticleCards } from "./ArticleCards";
import { LandingFooter, LandingHeader } from "./LandingPageView";

import search from "../assets/brand/search.svg";
import type { ProfileTab } from "./ProfileModalView";

import "../css/LandingPage.css";
import "../css/ArticlesPage.css";

type Order = "newest" | "oldest" | "title";

const ORDERS: { value: Order; label: string }[] = [
  { value: "newest", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "title", label: "Título (A–Z)" },
];

/** Every article in the home page's cards: searchable, filtered by section
    and ordered by date or title. */
export function ArticlesPageView({
  articles,
  currentUser,
  collabEnabled,
  inboxCount,
  onOpenUserModal,
  onSignOut,
}: {
  articles: ArticleCard[];
  currentUser: User | null;
  collabEnabled: boolean;
  inboxCount: number;
  onOpenUserModal: (tab?: ProfileTab) => void;
  onSignOut: () => void;
}) {
  const [query, setQuery] = useState("");
  // `null` shows every section.
  const [section, setSection] = useState<string | null>(null);
  const [order, setOrder] = useState<Order>("newest");

  const sections = useMemo(
    () =>
      [...new Set(articles.flatMap((a) => (a.kicker ? [a.kicker] : [])))].sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [articles],
  );

  const shown = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    const matching = articles.filter((article) => {
      if (section && article.kicker !== section) {
        return false;
      }
      const text = normalize(
        [article.title, article.summary, article.kicker].join(" "),
      );
      return words.every((word) => text.includes(word));
    });
    return matching.sort((a, b) => compare(a, b, order));
  }, [articles, query, section, order]);

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
        {/* The home page's search box, filtering the articles below. */}
        <div className="landing-search" role="search">
          <label className="landing-search-box">
            <img src={search} alt="" className="landing-search-icon" />
            <span className="visually-hidden">Pesquisar artigos</span>
            <input
              type="search"
              value={query}
              placeholder="Pesquise artigos…"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        {/* The home page's section title, as this page's heading. */}
        <h1 className="landing-section-title articles-title">Artigos</h1>
        <div className="articles-controls">
          {sections.length > 0 && (
            <div
              className="articles-filters"
              role="group"
              aria-label="Filtrar por seção"
            >
              <FilterButton
                active={section === null}
                onClick={() => setSection(null)}
              >
                Todos
              </FilterButton>
              {sections.map((name) => (
                <FilterButton
                  key={name}
                  active={section === name}
                  onClick={() => setSection(name)}
                >
                  {name}
                </FilterButton>
              ))}
            </div>
          )}
          <label className="articles-order">
            <span>Ordenar por</span>
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value as Order)}
            >
              {ORDERS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {shown.length > 0 ? (
          <ArticleCards articles={shown} />
        ) : (
          <p className="landing-carousel-message">
            {articles.length > 0
              ? "Nenhum artigo encontrado."
              : "Nenhum artigo publicado ainda."}
          </p>
        )}
      </main>
      <LandingFooter
        currentUser={currentUser}
        collabEnabled={collabEnabled}
        onOpenUserModal={onOpenUserModal}
      />
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={active ? "articles-filter is-active" : "articles-filter"}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** By date (articles without one go last) or by title. */
function compare(a: ArticleCard, b: ArticleCard, order: Order): number {
  if (order === "title") {
    return a.title.localeCompare(b.title, "pt-BR");
  }
  if (!a.date || !b.date) {
    return Number(!a.date) - Number(!b.date);
  }
  // ISO dates sort as text.
  return order === "newest"
    ? b.date.localeCompare(a.date)
    : a.date.localeCompare(b.date);
}

/** Lowercase, without accents: "Código" matches "codigo". */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
