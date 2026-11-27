import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { isEditor } from "../../../lib/roles";
import { uploadPath } from "../../../lib/uploadPath";
import { Button, type ButtonProps } from "../../atoms/Button";
import { ProjectPickerModal, type ProjectPickerServices } from "../projects/ProjectPickerModal";

export type EditCopyButtonServices = ProjectPickerServices &
  Pick<typeof import("../../../lib/db"), "getScoreForks">;

/**
 * "Editar uma cópia" (ticket 031), for people who can't edit the score where
 * it is: they pick one of their projects and open the score in the browser
 * formatting; saving creates the copy there (a fork), or a new version of
 * the copy that project already has. The original never changes.
 */
export function EditCopyButton({
  score,
  user,
  services,
  songbook,
  size = "sm",
  variant = "secondary",
}: {
  // `revisionId`: the version that is opened, and that the copy derives from.
  score: { scoreId: string; projectId: string; title: string; revisionId: string };
  user: User | null;
  services: EditCopyButtonServices;
  // Launched from a songbook: saving into its project moves the entry to the copy.
  songbook?: { id: string; projectId: string; revisionId: string };
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [preferred, setPreferred] = useState<string | undefined>(songbook?.projectId);

  useEffect(() => {
    if (!open) {return;}
    let active = true;
    // The project that already has a copy gets the new version.
    services.getScoreForks(score.scoreId).then(
      (forks) => {
        const mine = forks.find((f) => !f.deletedAt && f.projectId === songbook?.projectId) ??
          forks.find((f) => !f.deletedAt);
        if (active && mine) {setPreferred(mine.projectId);}
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [open, score.scoreId, services, songbook?.projectId]);

  if (!user) {
    return null;
  }
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        Editar uma cópia
      </Button>
      <ProjectPickerModal
        show={open}
        user={user}
        services={services}
        allow={isEditor}
        heading={`Editar uma cópia de “${score.title}”`}
        description="Você formata a partitura no navegador e, ao enviar, ela é salva como cópia no projeto escolhido. A original não muda."
        confirmLabel="Abrir formatação"
        preferredProjectId={preferred}
        exclude={[score.projectId]}
        onHide={() => setOpen(false)}
        onConfirm={(projectId) => {
          setOpen(false);
          void navigate(uploadPath({
            projectId,
            scoreId: score.scoreId,
            baseRevisionId: score.revisionId,
            mode: "reformat",
            ...(songbook && songbook.projectId === projectId
              ? { songbookId: songbook.id, expectedSongbookRevisionId: songbook.revisionId }
              : {}),
          }));
        }}
      />
    </>
  );
}
