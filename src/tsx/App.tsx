import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { AppNavigation } from "./AppNavigation";
import { AuthModal } from "./AuthModal";
import { ProfileModal } from "./ProfileModal";

import "bootstrap/dist/css/bootstrap.css";
import { useAuth } from "../auth";
import "../css/App.css";
import { FEATURE_FLAG_COLLAB_FLOW } from "../featureFlags";
import { getPendingUserProjectInvitations } from "../lib/db";
import { CreateProjectPage } from "./CreateProjectPage";
import { MeusProjetosPage } from "./MeusProjetosPage";
import { MyScoresPage } from "./MyScoresPage";
import { NotFoundPage } from "./NotFoundPage";
import { ProjectSettingsPage } from "./ProjectSettingsPage";
import { ProjectSongbooksPage } from "./ProjectSongbooksPage";
import { PublicProjectPage } from "./PublicProjectPage";
import { ScorePage } from "./ScorePage";
import { SongbookPage } from "./SongbookPage";

import { HomePage } from "./HomePage";

function App() {
  const [showUserModal, setShowUserModal] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  const { currentUser, pendingUser } = useAuth();

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
      <AppNavigation
        currentUser={currentUser}
        collabEnabled={FEATURE_FLAG_COLLAB_FLOW}
        inboxCount={inboxCount}
        onOpenUserModal={() => setShowUserModal(true)}
      />

      <Routes>
        <Route
          path="/"
          element={<HomePage onRequestLogin={() => setShowUserModal(true)} />}
        />
        <Route path="/score/:scoreId" element={<ScorePage />} />
        <Route path="/score/:scoreId/:revisionId" element={<ScorePage />} />
        {FEATURE_FLAG_COLLAB_FLOW && (
          <>
            <Route path="/my-scores" element={<MyScoresPage />} />
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
