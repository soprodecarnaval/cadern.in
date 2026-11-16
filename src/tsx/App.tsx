import { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AppNavigation } from "./AppNavigation";
import { AuthModal } from "./AuthModal";
import { ProfileModal } from "./ProfileModal";
import type { ProfileTab } from "./ProfileModalView";

import "bootstrap/dist/css/bootstrap.css";
import { useAuth } from "../auth";
import "../css/App.css";
import { FEATURE_FLAG_COLLAB_FLOW } from "../featureFlags";
import { getPendingUserProjectInvitations } from "../lib/db";
import { CreateProjectPage } from "./CreateProjectPage";
import { MeusProjetosPage } from "./MeusProjetosPage";
import { NotFoundPage } from "./NotFoundPage";
import { ProjectSettingsPage } from "./ProjectSettingsPage";
import { PublicProjectPage } from "./PublicProjectPage";
import { ScorePage } from "./ScorePage";
import { SongbookManagePage } from "./SongbookManagePage";
import { SongbookPage } from "./SongbookPage";
import { SongbookScorePage } from "./SongbookScorePage";

import { ArticlePage } from "./ArticlePage";
import { HomePage } from "./HomePage";
import { LandingPage } from "./LandingPage";

function App() {
  const [showUserModal, setShowUserModal] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>("profile");
  const openUserModal = (tab: ProfileTab = "profile") => {
    setProfileTab(tab);
    setShowUserModal(true);
  };
  const [inboxCount, setInboxCount] = useState(0);
  const { currentUser, pendingUser } = useAuth();
  // The landing and article pages draw their own header and footer.
  const { pathname } = useLocation();
  const isLanding = pathname === "/" || pathname.startsWith("/artigos/");

  useEffect(() => {
    if (!FEATURE_FLAG_COLLAB_FLOW || !currentUser) {
      setInboxCount(0);
      return;
    }
    void getPendingUserProjectInvitations(currentUser.uid).then((invs) =>
      setInboxCount(invs.length),
    );
  }, [currentUser]);

  useEffect(() => {
    if (pendingUser) {
      setShowUserModal(true);
    }
  }, [pendingUser]);

  return (
    <>
      {!isLanding && (
        <AppNavigation
          currentUser={currentUser}
          collabEnabled={FEATURE_FLAG_COLLAB_FLOW}
          inboxCount={inboxCount}
          onOpenUserModal={() => openUserModal()}
        />
      )}

      <Routes>
        <Route
          path="/"
          element={
            <LandingPage
              inboxCount={inboxCount}
              onOpenUserModal={openUserModal}
            />
          }
        />
        <Route
          path="/montar"
          element={<HomePage onRequestLogin={() => openUserModal()} />}
        />
        <Route
          path="/artigos/:slug"
          element={
            <ArticlePage inboxCount={inboxCount} onOpenUserModal={openUserModal} />
          }
        />
        <Route path="/score/:scoreId" element={<ScorePage />} />
        <Route path="/score/:scoreId/:revisionId" element={<ScorePage />} />
        {FEATURE_FLAG_COLLAB_FLOW && (
          <>
            <Route path="/projects" element={<MeusProjetosPage />} />
            <Route path="/projects/new" element={<CreateProjectPage />} />
            <Route path="/project/:slug" element={<PublicProjectPage />} />
            <Route
              path="/project/:slug/settings"
              element={<ProjectSettingsPage />}
            />
            <Route
              path="/project/:slug/songbook/:songbookSlug"
              element={<SongbookPage />}
            />
            <Route
              path="/project/:slug/songbook/:songbookSlug/manage"
              element={<SongbookManagePage />}
            />
            <Route
              path="/project/:slug/songbook/:songbookSlug/manage/score/:scoreId"
              element={<SongbookScorePage />}
            />
          </>
        )}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {currentUser ? (
        <ProfileModal
          show={showUserModal}
          onHide={() => setShowUserModal(false)}
          initialTab={profileTab}
          inboxCount={inboxCount}
          onInboxCountChange={setInboxCount}
        />
      ) : (
        <AuthModal
          show={showUserModal}
          onHide={() => setShowUserModal(false)}
        />
      )}
    </>
  );
}

export default App;
