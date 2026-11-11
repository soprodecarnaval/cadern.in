import { useParams } from "react-router-dom";
import { useAuth } from "../auth";
import * as services from "../lib/db";
import { useMemberRole } from "../lib/useMemberRole";
import { ProjectSongbooksPageView } from "./ProjectSongbooksPageView";

export function ProjectSongbooksPage() {
  const { currentUser } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const role = useMemberRole(slug);
  return (
    <ProjectSongbooksPageView
      services={services}
      currentUser={currentUser}
      role={role}
    />
  );
}
