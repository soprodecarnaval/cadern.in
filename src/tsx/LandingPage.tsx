import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { FEATURE_FLAG_COLLAB_FLOW as collabEnabled } from "../featureFlags";
import { getPublishedSongbooks, getSongbookRevision } from "../lib/db";
import { representativeCoverUrl } from "../lib/songbookCovers";
import { useCollectionContext } from "../useCollectionContext";
import {
  LandingPageView,
  type LandingArticle,
  type LandingSongbook,
  type LandingSongbooks,
} from "./LandingPageView";

// Placeholders until the articles are written: their pages don't exist yet.
// Without an `imageUrl` the image area shows as a grey box. The first two
// are shown; the section hides itself if this list is empty.
const articles: LandingArticle[] = [
  {
    title: "Como montar o caderninho do seu bloco",
    summary:
      "Um passo a passo da busca de partituras até o PDF pronto para imprimir e levar para a rua.",
    href: "/artigos/como-montar-o-caderninho",
    imageUrl: "/assets/articles/cadernos-impressos.jpg",
  },
  {
    title: "Formatando partituras com a extensão para Musescore",
    summary:
      "Como deixar suas partituras no padrão do cadern.in antes de enviá-las para o acervo.",
    href: "/artigos/extensao-musescore",
    imageUrl: "/assets/articles/trombone-na-rua.jpg",
  },
];

export function LandingPage(props: {
  inboxCount: number;
  onOpenUserModal: () => void;
}) {
  const { currentUser } = useAuth();
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
