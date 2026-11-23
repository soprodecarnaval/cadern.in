import type { User } from "firebase/auth";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { SongbookDoc } from "../../../../types/docs";
import { zInstrument, type Instrument } from "../../../../types/instrument";
import type { WithId } from "../../../lib/db";
import {
  instrumentLabel,
  readPreferredInstrument,
  storePreferredInstrument,
} from "../../../lib/preferredInstrument";
import { publicSongbookPath } from "../../../lib/routes";
import type { CoverUrls } from "../../../lib/songbookCovers";
import { matchesEveryWord } from "../../../utils/searchText";
import {
  LandingFooter,
  LandingHeader,
  SectionTitle,
  SongbookCarousel,
} from "../landing/LandingPageView";
import type { ProfileTab } from "../account/ProfileModalView";

import search from "../../../assets/brand/search.svg";
import "../landing/LandingPage.css";
import "./LibraryPage.css";

/** A published songbook, its project's name and, once loaded, its covers:
    the representative one and each instrument's. */
export type LibrarySongbook = WithId<SongbookDoc> & {
  projectTitle: string;
  coverUrl?: string;
  coverUrls?: CoverUrls;
};

export type LibrarySongbooks =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: LibrarySongbook[] };

type Order = "newest" | "mostAccessed" | "oldest" | "title";

const ORDERS: { value: Order; label: string }[] = [
  { value: "newest", label: "Mais recentes" },
  { value: "mostAccessed", label: "Mais acessados" },
  { value: "oldest", label: "Mais antigos" },
  { value: "title", label: "Título (A–Z)" },
];

// The "Instrumento" select's value for no instrument in particular: each songbook
// shows its representative cover.
const ANY_INSTRUMENT = "";

const LOADING_PLACEHOLDERS = 6;

// The carousel shows the newest few, as on the home page.
const CAROUSEL_SIZE = 12;

const updatedFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Every published songbook as a notebook, like the home page's carousel:
    searchable and ordered by date or title. "Instrumento" picks one:
    each songbook shows that instrument's cover, and the reader opens on it. */
export function LibraryPageView({
  songbooks,
  currentUser,
  collabEnabled,
  inboxCount,
  onOpenUserModal,
  onSignOut,
}: {
  songbooks: LibrarySongbooks;
  currentUser: User | null;
  collabEnabled: boolean;
  inboxCount: number;
  onOpenUserModal: (tab?: ProfileTab) => void;
  onSignOut: () => void;
}) {
  const [query, setQuery] = useState("");
  const [instrument, setInstrument] = useState<Instrument | typeof ANY_INSTRUMENT>(
    () => readPreferredInstrument() ?? ANY_INSTRUMENT,
  );
  const chooseInstrument = (value: string) => {
    const parsed = zInstrument.safeParse(value);
    if (parsed.success) {
      // The reader opens on the remembered instrument, if the songbook has it.
      storePreferredInstrument(parsed.data);
      setInstrument(parsed.data);
    } else {
      setInstrument(ANY_INSTRUMENT);
    }
  };
  const [order, setOrder] = useState<Order>("newest");

  // With an instrument chosen, its cover replaces the representative one
  // where it has one.
  const items = useMemo(
    () =>
      songbooks.status === "ready"
        ? songbooks.items.map((songbook) => {
            const coverUrl = instrument && songbook.coverUrls?.[instrument];
            return coverUrl ? { ...songbook, coverUrl } : songbook;
          })
        : [],
    [songbooks, instrument],
  );

  const newest = useMemo(
    () =>
      [...items]
        .sort((a, b) => compare(a, b, "newest"))
        .slice(0, CAROUSEL_SIZE),
    [items],
  );

  const shown = useMemo(
    () =>
      items
        .filter(
          (songbook) =>
            matchesEveryWord(
              query,
              `${songbook.title} ${songbook.projectTitle}`,
            ),
        )
        .sort((a, b) => compare(a, b, order)),
    [items, query, order],
  );

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
        {/* Not when there's nothing to show: the list below already says so. */}
        {(songbooks.status === "loading" || newest.length > 0) && (
          <section className="library-highlights" aria-labelledby="destaques">
            <SectionTitle id="destaques">Destaques</SectionTitle>
            <SongbookCarousel
              songbooks={
                songbooks.status === "loading"
                  ? songbooks
                  : { status: "ready", items: newest }
              }
            />
          </section>
        )}
        {/* The home page's search box, filtering the songbooks below. */}
        <div className="landing-search" role="search">
          <label className="landing-search-box">
            <img src={search} alt="" className="landing-search-icon" />
            <span className="visually-hidden">Pesquisar cadernos</span>
            <input
              type="search"
              value={query}
              placeholder="Pesquise cadernos ou projetos…"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <h1 className="landing-section-title library-title">Biblioteca</h1>
        <div className="landing-controls">
          <label className="landing-order">
            <span>Instrumento</span>
            <select
              value={instrument}
              onChange={(e) => chooseInstrument(e.target.value)}
            >
              <option value={ANY_INSTRUMENT}>Todos</option>
              {zInstrument.options.map((option) => (
                <option key={option} value={option}>
                  {instrumentLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="landing-order">
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

        {songbooks.status === "error" ? (
          <p className="landing-carousel-message">
            Não foi possível carregar os cadernos.
          </p>
        ) : songbooks.status === "loading" ? (
          <div className="library-grid" aria-busy="true">
            {Array.from({ length: LOADING_PLACEHOLDERS }, (_, i) => (
              <div
                key={i}
                className="landing-caderno library-caderno is-loading"
                aria-hidden="true"
              >
                <div className="landing-caderno-spiral" />
                <div className="landing-caderno-cover" />
              </div>
            ))}
          </div>
        ) : shown.length > 0 ? (
          <ul className="library-grid" aria-label="Cadernos">
            {shown.map((songbook) => (
              <li key={songbook.id}>
                <LibraryCaderno songbook={songbook} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="landing-carousel-message">
            {items.length > 0
              ? "Nenhum caderno encontrado."
              : "Nenhum caderno publicado ainda."}
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

/** The carousel's notebook, with its title and project written beneath. */
function LibraryCaderno({ songbook }: { songbook: LibrarySongbook }) {
  return (
    <Link
      className="landing-caderno library-caderno"
      to={publicSongbookPath(songbook.projectId, songbook.slug)}
    >
      <div className="landing-caderno-spiral" />
      {songbook.coverUrl ? (
        <div className="landing-caderno-cover has-image">
          <img src={songbook.coverUrl} alt="" />
        </div>
      ) : (
        // No cover yet: a blank notebook.
        <div className="landing-caderno-cover" />
      )}
      <span className="library-caderno-title">{songbook.title}</span>
      <span className="library-caderno-meta">
        {songbook.projectTitle}
        {" · "}
        <time dateTime={songbook.updatedAt.toDate().toISOString()}>
          {updatedFormat.format(songbook.updatedAt.toDate())}
        </time>
      </span>
    </Link>
  );
}

/** By last update (newest or oldest first) or by title.
    TODO: nothing counts songbook accesses yet, so "Mais acessados" shows the
    newest first until a counter exists. */
function compare(a: LibrarySongbook, b: LibrarySongbook, order: Order): number {
  if (order === "title") {
    return a.title.localeCompare(b.title, "pt-BR");
  }
  const diff = a.updatedAt.toMillis() - b.updatedAt.toMillis();
  return order === "oldest" ? diff : -diff;
}
