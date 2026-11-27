import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { copyTitle, duplicateSongbook, type DuplicateSongbookServices } from "../../../lib/duplicateSongbook";
import { canEditSongbook } from "../../../lib/roles";
import { songbookPath } from "../../../lib/routes";
import { Button, type ButtonProps } from "../../atoms/Button";
import { ProjectPickerModal, type ProjectPickerServices } from "../projects/ProjectPickerModal";

export type DuplicateSongbookButtonServices = ProjectPickerServices & DuplicateSongbookServices;

/**
 * "Duplicar" (ticket 029): copies a songbook into a project the person
 * administers and opens the copy's workspace, where it can be reorganized.
 * Signed-out people don't see it.
 */
export function DuplicateSongbookButton({
  songbook,
  user,
  services,
  size = "sm",
  variant = "secondary",
}: {
  songbook: { id: string; title: string };
  user: User | null;
  services: DuplicateSongbookButtonServices;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) {
    return null;
  }
  return (
    <>
      <Button
        size={size}
        variant={variant}
        onClick={() => setOpen(true)}
        aria-label={`Duplicar ${songbook.title}`}
      >
        Duplicar
      </Button>
      <ProjectPickerModal
        show={open}
        user={user}
        services={services}
        allow={canEditSongbook}
        heading="Duplicar caderninho"
        description="A cópia usa as mesmas versões das partituras e começa não publicada. Depois você pode reorganizá-la."
        confirmLabel="Duplicar e editar"
        nameField={{ label: "Título da cópia", initial: copyTitle(songbook.title) }}
        onHide={() => setOpen(false)}
        onConfirm={async (projectId, title) => {
          const copy = await duplicateSongbook(
            { sourceId: songbook.id, targetProjectId: projectId, title, createdBy: user.uid },
            services,
          );
          setOpen(false);
          void navigate(songbookPath(copy.projectId, copy.slug));
        }}
      />
    </>
  );
}
