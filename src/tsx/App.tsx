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
import { ProjectSongbooksPage } from "./ProjectSongbooksPage";
import { PublicProjectPage } from "./PublicProjectPage";
import { ScorePage } from "./ScorePage";
import { SongbookPage } from "./SongbookPage";

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
  // The landing page draws its own header and footer.
  const isLanding = useLocation().pathname === "/";

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
        <Route path="/score/:scoreId" element={<ScorePage />} />
        <Route path="/score/:scoreId/:revisionId" element={<ScorePage />} />
        {FEATURE_FLAG_COLLAB_FLOW && (
          <>
            <Route path="/projects" element={<MeusProjetosPage />} />
            <Route path="/projects/new" element={<CreateProjectPage />} />
            <Route path="/projects/:slug" element={<PublicProjectPage />} />
            <Route
              path="/projects/:slug/settings"
              element={<ProjectSettingsPage />}
            />
            <Route
              path="/projects/:slug/songbooks"
              element={<ProjectSongbooksPage />}
            />
            <Route
              path="/projects/:slug/songbooks/:songbookSlug"
              element={<SongbookPage />}
            />
            <Route
              path="/songbooks/:slug/:songbookSlug"
              element={<SongbookPage />}
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
