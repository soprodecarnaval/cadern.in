import type { User } from "firebase/auth";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  articleCards,
  articlePath,
  type Article,
  type ArticleBlock,
} from "../articles";
import {
  LandingFooter,
  LandingHeader,
  MoreLink,
  SectionTitle,
} from "./LandingPageView";
import { ArticleCards } from "./ArticleCards";
import type { ProfileTab } from "./ProfileModalView";

import "../css/LandingPage.css";
import "../css/ArticlePage.css";

// The articles index doesn't exist yet; it falls through to "not found".
const ARTICLES_INDEX = "/artigos";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function ArticlePageView({
  article,
  currentUser,
  collabEnabled,
  inboxCount,
  onOpenUserModal,
  onSignOut,
}: {
  article: Article;
  currentUser: User | null;
  collabEnabled: boolean;
  inboxCount: number;
  onOpenUserModal: (tab?: ProfileTab) => void;
  onSignOut: () => void;
}) {
  const others = articleCards.filter(
    (card) => card.href !== articlePath(article),
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
        <article className="article">
          <header className="article-header">
            <nav className="article-breadcrumb" aria-label="Você está em">
              <Link to={ARTICLES_INDEX}>Artigos</Link>
              {article.kicker && (
                <>
                  <span className="article-breadcrumb-separator" aria-hidden="true">|</span>
                  <span>{article.kicker}</span>
                </>
              )}
            </nav>
            <h1 className="article-title">{article.title}</h1>
            {article.deck && <p className="article-deck">{article.deck}</p>}
            <p className="article-meta">
              <span>
                Por <strong>{article.author}</strong>
              </span>
              <time dateTime={article.date}>
                {dateFormat.format(new Date(article.date))}
              </time>
              {article.source && (
                <span>
                  Publicado em{" "}
                  <a href={article.source.url} rel="noopener">
                    {article.source.name}
                  </a>
                </span>
              )}
            </p>
          </header>

          {article.lead && (
            <Figure {...article.lead} size="wide" className="article-lead" />
          )}

          <div className="article-body">
            {article.body.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>

          {article.source && (
            <aside className="article-source">
              <p>
                Publicado originalmente na{" "}
                <a href={article.source.url} rel="noopener">
                  <strong>{article.source.name}</strong>
                </a>
                .
              </p>
            </aside>
          )}
        </article>

        {others.length > 0 && (
          <section className="landing-section">
            <SectionTitle>Leia mais</SectionTitle>
            <ArticleCards articles={others.slice(0, 2)} />
            <MoreLink to={ARTICLES_INDEX}>artigos</MoreLink>
          </section>
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

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "paragraph":
      return <p>{inline(block.text)}</p>;
    case "heading":
      return (
        <h2 className="article-heading">
          <span>{inline(block.text)}</span>
        </h2>
      );
    case "quote":
      return (
        <blockquote className="article-quote">
          <p>{block.text}</p>
          {block.cite && <cite>{block.cite}</cite>}
        </blockquote>
      );
    case "figure":
      return <Figure {...block} />;
  }
}

function Figure({
  src,
  alt,
  caption,
  size = "text",
  className,
}: {
  src: string;
  alt: string;
  caption?: string;
  size?: "narrow" | "text" | "wide";
  className?: string;
}) {
  return (
    <figure
      className={["article-figure", `is-${size}`, className]
        .filter(Boolean)
        .join(" ")}
    >
      <img src={src} alt={alt} loading={className ? undefined : "lazy"} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** Renders **bold** and [links](url) in article text; the rest is plain. */
function inline(text: string): ReactNode[] {
  const pattern = /\*\*(.+?)\*\*|\[(.+?)\]\((https?:\/\/[^)\s]+)\)/g;
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    parts.push(text.slice(last, at));
    const [, bold, label, href] = match;
    parts.push(
      bold !== undefined ? (
        <strong key={at}>{bold}</strong>
      ) : (
        <a key={at} href={href} rel="noopener">
          {label}
        </a>
      ),
    );
    last = at + match[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}
