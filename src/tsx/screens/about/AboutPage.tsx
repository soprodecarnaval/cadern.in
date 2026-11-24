import { useEffect } from "react";
import { useAuth } from "../../../auth";
import { FEATURE_FLAG_COLLAB_FLOW as collabEnabled } from "../../../featureFlags";
import { AboutPageView } from "./AboutPageView";
import type { ProfileTab } from "../account/ProfileModalView";

export function AboutPage(props: {
  inboxCount: number;
  onOpenUserModal: (tab?: ProfileTab) => void;
}) {
  const { currentUser, logout } = useAuth();

  useEffect(() => {
    const previous = document.title;
    document.title = "Sobre · cadern.in";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <AboutPageView
      {...props}
      currentUser={currentUser}
      collabEnabled={collabEnabled}
      onSignOut={() => void logout()}
    />
  );
}
