import { useEffect } from "react";
import { articleCards } from "../../../articles";
import { useAuth } from "../../../auth";
import { FEATURE_FLAG_COLLAB_FLOW as collabEnabled } from "../../../featureFlags";
import { ArticlesPageView } from "./ArticlesPageView";
import type { ProfileTab } from "../account/ProfileModalView";

export function ArticlesPage(props: {
  inboxCount: number;
  onOpenUserModal: (tab?: ProfileTab) => void;
}) {
  const { currentUser, logout } = useAuth();

  useEffect(() => {
    const previous = document.title;
    document.title = "Artigos · cadern.in";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <ArticlesPageView
      {...props}
      articles={articleCards}
      currentUser={currentUser}
      collabEnabled={collabEnabled}
      onSignOut={() => void logout()}
    />
  );
}
