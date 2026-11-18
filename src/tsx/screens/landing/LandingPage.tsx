import { useEffect, useState } from "react";
import { useAuth } from "../../../auth";
import { FEATURE_FLAG_COLLAB_FLOW as collabEnabled } from "../../../featureFlags";
import { getPublishedSongbooks } from "../../../lib/db";
import { withCovers } from "../../../lib/songbookCovers";
import { useCollectionContext } from "../../../useCollectionContext";
// Only articles with pages: the placeholders would lead to "not found".
import { publishedArticleCards as articles } from "../../../articles";
import { LandingPageView, type LandingSongbooks } from "./LandingPageView";
import type { ProfileTab } from "../account/ProfileModalView";


// The carousel shows a few; the biblioteca lists them all.
const CAROUSEL_SIZE = 12;

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
    getPublishedSongbooks(CAROUSEL_SIZE)
      .then(async (items) => {
        if (cancelled) {
          return;
        }
        // Show the songbooks now; their covers fill in once loaded.
        setSongbooks({ status: "ready", items });
        const covered = await Promise.all(items.map(withCovers));
        if (!cancelled) {
          setSongbooks({ status: "ready", items: covered });
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

