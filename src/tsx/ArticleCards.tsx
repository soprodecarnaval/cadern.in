import { useState } from "react";
import { Link } from "react-router-dom";

import { formatArticleDate, type ArticleCard } from "../articles";

// Article cards sit in a two-column grid (~656px each) on wide screens and
// one full-width column on phones; half the viewport in between.
const IMAGE_SIZES =
  "(min-width: 1100px) 656px, (min-width: 628px) 50vw, calc(100vw - 32px)";

/** The home page's article cards: an image, the title and a summary. */
export function ArticleCards({ articles }: { articles: ArticleCard[] }) {
  return (
    <div className="landing-articles">
      {articles.map((article) => (
        <Link key={article.href} className="landing-article" to={article.href}>
          <div className="landing-article-image">
            <CardImage article={article} />
          </div>
          {(article.kicker || article.date) && (
            <p className="landing-article-meta">
              {article.kicker}
              {article.kicker && article.date && " · "}
              {article.date && (
                <time dateTime={article.date}>
                  {formatArticleDate(article.date)}
                </time>
              )}
            </p>
          )}
          <h3>{article.title}</h3>
          <p className="landing-article-summary">{article.summary}</p>
        </Link>
      ))}
    </div>
  );
}

/** Without an image, or if it fails to load, the grey box shows instead. */
function CardImage({ article }: { article: ArticleCard }) {
  const [failed, setFailed] = useState(false);
  if (!article.imageUrl || failed) {
    return null;
  }
  return (
    <img
      src={article.imageUrl}
      srcSet={article.imageSrcSet}
      sizes={IMAGE_SIZES}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
