import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { findArticle } from "../../../articles";
import { useAuth } from "../../../auth";
import { FEATURE_FLAG_COLLAB_FLOW as collabEnabled } from "../../../featureFlags";
import { ArticlePageView } from "./ArticlePageView";
import { NotFoundPage } from "../not-found/NotFoundPage";
import type { ProfileTab } from "../account/ProfileModalView";

export function ArticlePage(props: {
  inboxCount: number;
  onOpenUserModal: (tab?: ProfileTab) => void;
}) {
  const { slug } = useParams();
  const { currentUser, logout } = useAuth();
  const article = findArticle(slug);

  useEffect(() => {
    if (!article) {
      return;
    }
    const previous = document.title;
    document.title = `${article.title} · cadern.in`;
    window.scrollTo(0, 0);
    return () => {
      document.title = previous;
    };
  }, [article]);

  if (!article) {
    return <NotFoundPage />;
  }
  return (
    <ArticlePageView
      {...props}
      article={article}
      currentUser={currentUser}
      collabEnabled={collabEnabled}
      onSignOut={() => void logout()}
    />
  );
}
