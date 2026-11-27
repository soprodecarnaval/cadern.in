import { Page } from "../../../atoms/Page";
import { useEffect, useState } from "react";
import { Alert, Spinner } from "react-bootstrap";
import { useParams } from "react-router-dom";

import type { WithId } from "../../../../lib/db";
import type { SongbookDoc, SongbookRevisionDoc } from "../../../../../types/docs";
import type { NumberedSongbookItemViewModel } from "../../../../../types/viewModels";
import { fromSongbookRevision } from "../../../../lib/songbook";
import { buildSongbookSections } from "../../../../lib/pdfGeneration";
import { canEditSongbook, canRepinSongbook, type Role } from "../../../../lib/roles";
import { songbookEditPath, songbookPath } from "../../../../lib/routes";
import { Link } from "../../../atoms/Link";
import { ProjectBreadcrumb } from "../../../components/navigation/ProjectBreadcrumb";
import {
  DuplicateSongbookButton,
  type DuplicateSongbookButtonServices,
} from "../../../components/songbooks/DuplicateSongbookButton";

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
 * review history (008). Members get a link to their workspace
 * (SongbookManagePageView, behind a membership check) and signed-in people
 * can duplicate the songbook into their own project (029, 030).
 */
export type SongbookPageServices = {
  generateSongbookPdfs: typeof import("../../../../lib/generateSongbookPdfs").generateSongbookPdfs;
} & Pick<
  typeof import("../../../../lib/db"),
  "getSongbook" | "getSongbookRevision"
> & {
    loadPinnedScores: typeof import("../../../../lib/songbookScores").loadPinnedScores;
  } & DuplicateSongbookButtonServices;

export function SongbookPageView({
  services,
  components,
  currentUser = null,
  role,
}: {
  services: SongbookPageServices;
  currentUser?: import("firebase/auth").User | null;
  // The viewer's role in the songbook's project: members get "Editar" (030).
  role?: Role | "loading";
  components: {
    SongbookReader: typeof import("../../../components/songbooks/reader/SongbookReader").SongbookReader;
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
      <Page className="mt-4">
        <Spinner animation="border" />
      </Page>
    );
  }
  if (!loaded) {
    return (
      <Page className="mt-4">
        <Alert variant="danger">Caderninho não encontrado.</Alert>
      </Page>
    );
  }

  const { songbook, revision, items } = loaded;
  const myRole = role === "loading" ? undefined : role;
  const actions = (
    <div className="d-flex flex-column gap-2">
      <ProjectBreadcrumb
        signedIn={!!currentUser}
        project={{ id: songbook.projectId }}
        songbook={{ slug: songbook.slug, title: songbook.title }}
      />
      <div className="d-flex flex-wrap gap-2">
        {canEditSongbook(myRole) ? (
          <Link to={songbookEditPath(songbook.projectId, songbook.slug)} size="sm" aria-label={`Editar ${songbook.title}`}>
            Editar
          </Link>
        ) : canRepinSongbook(myRole) ? (
          <Link to={songbookPath(songbook.projectId, songbook.slug)} size="sm">
            Trocar versões
          </Link>
        ) : null}
        <DuplicateSongbookButton songbook={songbook} user={currentUser} services={services} />
      </div>
    </div>
  );
  return (
    <components.SongbookReader
      title={songbook.title}
      projectId={songbook.projectId}
      items={items}
      actions={actions}
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
