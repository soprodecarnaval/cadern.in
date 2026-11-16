import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { FEATURE_FLAG_COLLAB_FLOW as collabEnabled } from "../featureFlags";
import { getPublishedSongbooks, getSongbookRevision } from "../lib/db";
import { representativeCoverUrl } from "../lib/songbookCovers";
import { useCollectionContext } from "../useCollectionContext";
import { articleCards as articles } from "../articles";
import {
  LandingPageView,
  type LandingSongbook,
  type LandingSongbooks,
} from "./LandingPageView";
import type { ProfileTab } from "./ProfileModalView";


export function LandingPage(props: {
  inboxCount: number;
  onOpenUserModal: (tab?: ProfileTab) => void;
}) {
  const { currentUser, logout } = useAuth();
  const collection = useCollectionContext();
  const [songbooks, setSongbooks] = useState<LandingSongbooks>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    getPublishedSongbooks()
      .then(async (items) => {
        if (cancelled) {
          return;
        }
        // Show the songbooks now; their covers fill in once loaded.
        setSongbooks({ status: "ready", items });
        const withCovers = await Promise.all(items.map(withCover));
        if (!cancelled) {
          setSongbooks({ status: "ready", items: withCovers });
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load published songbooks", err);
        if (!cancelled) {setSongbooks({ status: "error" });}
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <LandingPageView
      {...props}
      currentUser={currentUser}
      collabEnabled={collabEnabled}
      collection={collection}
      songbooks={songbooks}
      articles={articles}
      onSignOut={() => void logout()}
    />
  );
}

/** Adds the current revision's cover, if any. Without one, it stays as is. */
async function withCover(songbook: LandingSongbook): Promise<LandingSongbook> {
  try {
    const revision = await getSongbookRevision(
      songbook.id,
      songbook.currentRevisionId,
    );
    const coverUrl = revision && representativeCoverUrl(revision.covers);
    return coverUrl ? { ...songbook, coverUrl } : songbook;
  } catch (err) {
    console.error(`Failed to load the cover of ${songbook.id}`, err);
    return songbook;
  }
}
