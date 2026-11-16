import type { ReactNode } from "react";
import { useAuth } from "../../../auth";
import { FEATURE_FLAG_COLLAB_FLOW as collabEnabled } from "../../../featureFlags";
import { LandingFooter, LandingHeader } from "./LandingPageView";
import type { ProfileTab } from "../account/ProfileModalView";

import "./LandingPage.css";

/**
 * The landing page's header and footer around a page that keeps its own
 * styling. Only the header and footer get the landing styles, so the page's
 * Bootstrap buttons and type are left as they are.
 */
export function LandingChrome({
  inboxCount,
  onOpenUserModal,
  children,
}: {
  inboxCount: number;
  onOpenUserModal: (tab?: ProfileTab) => void;
  children: ReactNode;
}) {
  const { currentUser, logout } = useAuth();
  return (
    <div className="landing-chrome">
      <div className="landing landing-chrome-bar">
        <LandingHeader
          currentUser={currentUser}
          collabEnabled={collabEnabled}
          inboxCount={inboxCount}
          onOpenUserModal={onOpenUserModal}
          onSignOut={() => void logout()}
        />
      </div>
      <div className="landing-chrome-body">{children}</div>
      <div className="landing landing-chrome-bar">
        <LandingFooter
          currentUser={currentUser}
          collabEnabled={collabEnabled}
          onOpenUserModal={onOpenUserModal}
        />
      </div>
    </div>
  );
}
