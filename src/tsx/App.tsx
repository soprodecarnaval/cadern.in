import { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AppNavigation } from "./components/navigation/AppNavigation";
import { AuthModal } from "./screens/auth/AuthModal";
import { ProfileModal } from "./screens/account/ProfileModal";
import type { ProfileTab } from "./screens/account/ProfileModalView";

import "bootstrap/dist/css/bootstrap.css";
import { useAuth } from "../auth";
import "../styles/app.css";
import { FEATURE_FLAG_COLLAB_FLOW } from "../featureFlags";
import { getPendingUserProjectInvitations } from "../lib/db";
import { CreateProjectPage } from "./screens/projects/create/CreateProjectPage";
import { MeusProjetosPage } from "./screens/projects/list/MeusProjetosPage";
import { NotFoundPage } from "./screens/not-found/NotFoundPage";
import { ProjectSettingsPage } from "./screens/projects/settings/ProjectSettingsPage";
import { PublicProjectPage } from "./screens/projects/detail/PublicProjectPage";
import { ScorePage } from "./screens/scores/ScorePage";
import { SongbookManagePage } from "./screens/songbooks/manage/SongbookManagePage";
import { SongbookPage } from "./screens/songbooks/public/SongbookPage";
import { SongbookScorePage } from "./screens/songbooks/review/SongbookScorePage";

import { ArticlePage } from "./screens/articles/ArticlePage";
import { ArticlesPage } from "./screens/articles/ArticlesPage";
import { HomePage } from "./screens/builder/HomePage";
import { LandingPage } from "./screens/landing/LandingPage";

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
  const isLanding =
    pathname === "/" ||
    pathname === "/artigos" ||
    pathname.startsWith("/artigos/");

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
          path="/artigos"
          element={
            <ArticlesPage inboxCount={inboxCount} onOpenUserModal={openUserModal} />
          }
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
