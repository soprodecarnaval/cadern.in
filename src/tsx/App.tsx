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
import { ROUTE_PATTERNS } from "../lib/routes";
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
    pathname === ROUTE_PATTERNS.home ||
    pathname === ROUTE_PATTERNS.articles ||
    pathname.startsWith(`${ROUTE_PATTERNS.articles}/`);

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
          path={ROUTE_PATTERNS.home}
          element={
            <LandingPage
              inboxCount={inboxCount}
              onOpenUserModal={openUserModal}
            />
          }
        />
        <Route
          path={ROUTE_PATTERNS.builder}
          element={<HomePage onRequestLogin={() => openUserModal()} />}
        />
        <Route
          path={ROUTE_PATTERNS.articles}
          element={
            <ArticlesPage inboxCount={inboxCount} onOpenUserModal={openUserModal} />
          }
        />
        <Route
          path={ROUTE_PATTERNS.article}
          element={
            <ArticlePage inboxCount={inboxCount} onOpenUserModal={openUserModal} />
          }
        />
        <Route path={ROUTE_PATTERNS.score} element={<ScorePage />} />
        <Route path={ROUTE_PATTERNS.scoreRevision} element={<ScorePage />} />
        {FEATURE_FLAG_COLLAB_FLOW && (
          <>
            <Route path={ROUTE_PATTERNS.projects} element={<MeusProjetosPage />} />
            <Route path={ROUTE_PATTERNS.newProject} element={<CreateProjectPage />} />
            <Route path={ROUTE_PATTERNS.project} element={<PublicProjectPage />} />
            <Route
              path={ROUTE_PATTERNS.projectSettings}
              element={<ProjectSettingsPage />}
            />
            <Route
              path={ROUTE_PATTERNS.publicSongbook}
              element={<SongbookPage />}
            />
            <Route
              path={ROUTE_PATTERNS.songbook}
              element={<SongbookManagePage />}
            />
            <Route
              path={ROUTE_PATTERNS.songbookScore}
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
