import { useParams } from "react-router-dom";
import { useAuth } from "../auth";
import * as services from "../lib/db";
import { useMemberRole } from "../lib/useMemberRole";
import { ProjectSettingsPageView } from "./ProjectSettingsPageView";

export function ProjectSettingsPage() {
  const { currentUser } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const myRole = useMemberRole(slug);
  return (
    <ProjectSettingsPageView
      services={services}
      currentUser={currentUser}
      myRole={myRole}
    />
  );
}
