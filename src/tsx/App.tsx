import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { useScrollToTopOnNavigate } from "./components/navigation/useScrollToTopOnNavigate";
import { AuthModal } from "./screens/auth/AuthModal";
import { ProfileModal } from "./screens/account/ProfileModal";
import type { ProfileTab } from "./screens/account/ProfileModalView";

import "bootstrap/dist/css/bootstrap.css";
import { useAuth } from "../auth";
import "../styles/app.css";
import { FEATURE_FLAG_BROWSER_UPLOAD, FEATURE_FLAG_COLLAB_FLOW } from "../featureFlags";
import { getPendingUserProjectInvitations } from "../lib/db";
import { ROUTE_PATTERNS, isReservedProjectSlug, isYearOnlySlug } from "../lib/routes";
import { CreateProjectPage } from "./screens/projects/create/CreateProjectPage";
import { MeusProjetosPage } from "./screens/projects/list/MeusProjetosPage";
import { NotFoundPage } from "./screens/not-found/NotFoundPage";
import { ProjectSettingsPage } from "./screens/projects/settings/ProjectSettingsPage";
import { PublicProjectPage } from "./screens/projects/detail/PublicProjectPage";
import { ScorePage } from "./screens/scores/ScorePage";
import { EnviarPage } from "./screens/upload/EnviarPage";
import { ExporterPage } from "./screens/exporter/ExporterPage";
import { SongbookManagePage } from "./screens/songbooks/manage/SongbookManagePage";
import { SongbookPage } from "./screens/songbooks/public/SongbookPage";
import { SongbookScorePage } from "./screens/songbooks/review/SongbookScorePage";

import { ArticlePage } from "./screens/articles/ArticlePage";
import { ArticlesPage } from "./screens/articles/ArticlesPage";
import { ContributePage } from "./screens/contribute/ContributePage";
import { AboutPage } from "./screens/about/AboutPage";
import { HelpPage } from "./screens/help/HelpPage";
import { HomePage } from "./screens/builder/HomePage";
import { LandingChrome } from "./screens/landing/LandingChrome";
import { LandingPage } from "./screens/landing/LandingPage";
import { LibraryPage } from "./screens/library/LibraryPage";

/** Year-only URLs belonged to the old static songbook pages. Project slugs
    cannot use them. Until each static page is removed, the static file wins;
    otherwise send the year to the home page. */
function ProjectRoute({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const { search, hash } = useLocation();

  if (isYearOnlySlug(slug)) {
    return (
      <Navigate
        replace
        to={{ pathname: ROUTE_PATTERNS.home, search, hash }}
      />
    );
  }

  if (isReservedProjectSlug(slug)) {
    return <NotFoundPage />;
  }

  return <>{children}</>;
}

/** Catches project routes when the collab flag is off, and year-only paths
    that have no static page left. */
function FallbackRoute() {
  const { pathname, search, hash } = useLocation();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 1 && isYearOnlySlug(segments[0])) {
    return (
      <Navigate
        replace
        to={{ pathname: ROUTE_PATTERNS.home, search, hash }}
      />
    );
  }

  return <NotFoundPage />;
}

function App() {
  useScrollToTopOnNavigate();
  const [showUserModal, setShowUserModal] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>("profile");
  const openUserModal = (tab: ProfileTab = "profile") => {
    setProfileTab(tab);
    setShowUserModal(true);
  };
  const [inboxCount, setInboxCount] = useState(0);
  const { currentUser, pendingUser } = useAuth();
  // Pages that draw their own header and footer do not need LandingChrome.
  const { pathname } = useLocation();
  const drawsOwnChrome =
    pathname === ROUTE_PATTERNS.home ||
    pathname === ROUTE_PATTERNS.library ||
    pathname === ROUTE_PATTERNS.articles ||
    pathname === ROUTE_PATTERNS.contribute ||
    pathname === ROUTE_PATTERNS.about ||
    pathname === ROUTE_PATTERNS.help ||
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

  const routes = (
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
          path={ROUTE_PATTERNS.library}
          element={
            <LibraryPage inboxCount={inboxCount} onOpenUserModal={openUserModal} />
          }
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
        <Route
          path={ROUTE_PATTERNS.help}
          element={
            <HelpPage inboxCount={inboxCount} onOpenUserModal={openUserModal} />
          }
        />
        <Route
          path={ROUTE_PATTERNS.about}
          element={
            <AboutPage inboxCount={inboxCount} onOpenUserModal={openUserModal} />
          }
        />
        <Route
          path={ROUTE_PATTERNS.contribute}
          element={
            <ContributePage inboxCount={inboxCount} onOpenUserModal={openUserModal} />
          }
        />
        <Route path={ROUTE_PATTERNS.score} element={<ScorePage />} />
        <Route path={ROUTE_PATTERNS.scoreRevision} element={<ScorePage />} />
        {FEATURE_FLAG_COLLAB_FLOW && (
          <>
            <Route path={ROUTE_PATTERNS.projects} element={<MeusProjetosPage />} />
            <Route path={ROUTE_PATTERNS.newProject} element={<CreateProjectPage />} />
            <Route
              path={ROUTE_PATTERNS.project}
              element={
                <ProjectRoute>
                  <PublicProjectPage />
                </ProjectRoute>
              }
            />
            {FEATURE_FLAG_BROWSER_UPLOAD && (
              <Route
                path={ROUTE_PATTERNS.upload}
                element={
                  <ProjectRoute>
                    <EnviarPage />
                  </ProjectRoute>
                }
              />
            )}
            <Route
              path={ROUTE_PATTERNS.exporter}
              element={
                <ProjectRoute>
                  <ExporterPage />
                </ProjectRoute>
              }
            />
            <Route
              path={ROUTE_PATTERNS.projectSettings}
              element={
                <ProjectRoute>
                  <ProjectSettingsPage />
                </ProjectRoute>
              }
            />
            <Route
              path={ROUTE_PATTERNS.publicSongbook}
              element={
                <ProjectRoute>
                  <SongbookPage />
                </ProjectRoute>
              }
            />
            <Route
              path={ROUTE_PATTERNS.songbook}
              element={
                <ProjectRoute>
                  <SongbookManagePage />
                </ProjectRoute>
              }
            />
            <Route
              path={ROUTE_PATTERNS.songbookScore}
              element={
                <ProjectRoute>
                  <SongbookScorePage />
                </ProjectRoute>
              }
            />
          </>
        )}
        <Route path="*" element={<FallbackRoute />} />
      </Routes>
  );

  return (
    <>
      {drawsOwnChrome ? (
        routes
      ) : (
        <LandingChrome inboxCount={inboxCount} onOpenUserModal={openUserModal}>
          {routes}
        </LandingChrome>
      )}

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
