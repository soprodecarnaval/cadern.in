import { useEffect, useState } from "react";
import { Alert, Container, Spinner } from "react-bootstrap";
import { useParams } from "react-router-dom";

import type { WithId } from "../lib/db";
import type { SongbookDoc, SongbookRevisionDoc } from "../../types/docs";
import type { NumberedSongbookItemViewModel } from "../../types/viewModels";
import { fromSongbookRevision } from "../lib/songbook";
import { buildSongbookSections } from "../lib/pdfGeneration";

interface Loaded {
  songbook: WithId<SongbookDoc>;
  revision: WithId<SongbookRevisionDoc>;
  items: NumberedSongbookItemViewModel[];
}

async function load(
  projectId: string,
  slug: string,
  services: SongbookPageServices,
): Promise<Loaded | null> {
  const songbook = await services.getSongbook(projectId, slug);
  if (!songbook || songbook.deletedAt || !songbook.isPublished) {
    return null;
  }
  const revision = await services
    .getSongbookRevision(songbook.id, songbook.currentRevisionId)
    .catch(() => null);
  if (!revision) {
    return null;
  }
  const items = fromSongbookRevision(
    revision,
    await services.loadPinnedScores(revision),
  );
  return { songbook, revision, items };
}

/**
 * Public reader for a published songbook: its current revision only, no
 * review history, no member controls — even for a signed-in member who
 * reached this URL directly (008). The member workspace lives at
 * SongbookManagePageView, behind a membership check.
 */
export type SongbookPageServices = {
  generateSongbookPdfs: typeof import("../lib/generateSongbookPdfs").generateSongbookPdfs;
} & Pick<
  typeof import("../lib/db"),
  "getSongbook" | "getSongbookRevision"
> & {
    loadPinnedScores: typeof import("../lib/songbookScores").loadPinnedScores;
  };

export function SongbookPageView({
  services,
  components,
}: {
  services: SongbookPageServices;
  components: {
    SongbookReader: typeof import("./SongbookReader").SongbookReader;
  };
}) {
  const { slug: projectId, songbookSlug } = useParams<{
    slug: string;
    songbookSlug: string;
  }>();
  const [loaded, setLoaded] = useState<Loaded | null | "loading">("loading");

  useEffect(() => {
    if (!projectId || !songbookSlug) {
      return;
    }
    setLoaded("loading");
    void load(projectId, songbookSlug, services).then(setLoaded);
  }, [projectId, songbookSlug, services]);

  if (loaded === "loading") {
    return (
      <Container className="mt-4">
        <Spinner animation="border" />
      </Container>
    );
  }
  if (!loaded) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">Caderninho não encontrado.</Alert>
      </Container>
    );
  }

  const { songbook, revision, items } = loaded;
  return (
    <components.SongbookReader
      title={songbook.title}
      items={items}
      onDownloadPdf={(instrument) =>
        services.generateSongbookPdfs({
          sections: buildSongbookSections(items),
          instruments: [instrument],
          title: songbook.title,
          covers: { [instrument]: revision.covers[instrument]?.url ?? "" },
          fallbackInstruments: new Set(),
          carnivalMode: false,
          backSheetPageNumber: false,
          antiAssedioPages: false,
        })
      }
    />
  );
}
