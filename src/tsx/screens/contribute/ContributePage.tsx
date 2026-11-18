import { useEffect } from "react";
import { useAuth } from "../../../auth";
import { FEATURE_FLAG_COLLAB_FLOW as collabEnabled } from "../../../featureFlags";
import { ContributePageView } from "./ContributePageView";
import type { ProfileTab } from "../account/ProfileModalView";

export function ContributePage(props: {
  inboxCount: number;
  onOpenUserModal: (tab?: ProfileTab) => void;
}) {
  const { currentUser, logout } = useAuth();

  useEffect(() => {
    const previous = document.title;
    document.title = "Contribua · cadern.in";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <ContributePageView
      {...props}
      currentUser={currentUser}
      collabEnabled={collabEnabled}
      onSignOut={() => void logout()}
    />
  );
}
