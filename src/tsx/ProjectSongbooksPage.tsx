import { Navigate, useParams } from "react-router-dom";

export function ProjectSongbooksPage() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate replace to={`/projects/${encodeURIComponent(slug ?? "")}`} />;
}
