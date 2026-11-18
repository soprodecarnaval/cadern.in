import { useEffect, useState } from "react";
import { useAuth } from "../../../auth";
import { FEATURE_FLAG_COLLAB_FLOW as collabEnabled } from "../../../featureFlags";
import { getAllProjects, getPublishedSongbooks } from "../../../lib/db";
import { withCovers } from "../../../lib/songbookCovers";
import { LibraryPageView, type LibrarySongbooks } from "./LibraryPageView";
import type { ProfileTab } from "../account/ProfileModalView";

export function LibraryPage(props: {
  inboxCount: number;
  onOpenUserModal: (tab?: ProfileTab) => void;
}) {
  const { currentUser, logout } = useAuth();
  const [songbooks, setSongbooks] = useState<LibrarySongbooks>({
    status: "loading",
  });

  useEffect(() => {
    const previous = document.title;
    document.title = "Biblioteca · cadern.in";
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPublishedSongbooks(), getAllProjects()])
      .then(async ([published, projects]) => {
        if (cancelled) {
          return;
        }
        const titles = new Map(projects.map((p) => [p.id, p.title]));
        const items = published.map((songbook) => ({
          ...songbook,
          projectTitle: titles.get(songbook.projectId) ?? songbook.projectId,
        }));
        // Show the songbooks now; their covers fill in once loaded.
        setSongbooks({ status: "ready", items });
        const covered = await Promise.all(items.map(withCovers));
        if (!cancelled) {
          setSongbooks({ status: "ready", items: covered });
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load the biblioteca", err);
        if (!cancelled) {
          setSongbooks({ status: "error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <LibraryPageView
      {...props}
      songbooks={songbooks}
      currentUser={currentUser}
      collabEnabled={collabEnabled}
      onSignOut={() => void logout()}
    />
  );
}
