import { Link } from "react-router-dom";
import {
  projectPath,
  projectsPath,
  publicSongbookPath,
  scorePath,
  songbookPath,
} from "../../../lib/routes";
import "./ProjectBreadcrumb.css";

/**
 * Where a project page sits: Meus projetos › Projeto › Caderninho › Partitura
 * (ticket 033). Each segment is optional; the last one given is the current
 * page and is not a link. "Meus projetos" shows only to signed-in people.
 */
export function ProjectBreadcrumb({
  signedIn,
  project,
  songbook,
  score,
  current,
}: {
  signedIn: boolean;
  project?: { id: string; title?: string };
  // `member`: link to the workspace (gerenciar) instead of the public page.
  songbook?: { slug: string; title: string; member?: boolean };
  score?: { id: string; title: string };
  // A last, unlinked segment such as "Enviar partitura" or "Configurações".
  current?: string;
}) {
  const items: { label: string; to?: string }[] = [];
  if (signedIn) {
    items.push({ label: "Meus projetos", to: projectsPath() });
  }
  if (project) {
    items.push({ label: project.title || project.id, to: projectPath(project.id) });
  }
  if (project && songbook) {
    items.push({
      label: songbook.title,
      to: songbook.member
        ? songbookPath(project.id, songbook.slug)
        : publicSongbookPath(project.id, songbook.slug),
    });
  }
  if (score) {
    items.push({ label: score.title, to: scorePath(score.id) });
  }
  if (current) {
    items.push({ label: current });
  }
  if (items.length === 0) {
    return null;
  }
  return (
    <nav aria-label="Navegação do projeto" className="ds-breadcrumb">
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${i}:${item.label}`}>
              {last || !item.to ? (
                <span aria-current={last ? "page" : undefined}>{item.label}</span>
              ) : (
                <Link to={item.to}>{item.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
