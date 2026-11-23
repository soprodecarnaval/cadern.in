import { useEffect } from "react";
import { useAuth } from "../../../auth";
import { FEATURE_FLAG_COLLAB_FLOW as collabEnabled } from "../../../featureFlags";
import { HelpPageView } from "./HelpPageView";
import type { ProfileTab } from "../account/ProfileModalView";

export function HelpPage(props: {
  inboxCount: number;
  onOpenUserModal: (tab?: ProfileTab) => void;
}) {
  const { currentUser, logout } = useAuth();

  useEffect(() => {
    const previous = document.title;
    document.title = "Ajuda · cadern.in";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <HelpPageView
      {...props}
      currentUser={currentUser}
      collabEnabled={collabEnabled}
      onSignOut={() => void logout()}
    />
  );
}
