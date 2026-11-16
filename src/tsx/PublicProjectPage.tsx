import { useParams } from "react-router-dom";
import { useAuth } from "../auth";
import * as services from "../lib/db";
import { useMemberRole } from "../lib/useMemberRole";
import { PublicProjectPageView } from "./PublicProjectPageView";

export function PublicProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const { currentUser } = useAuth();
  const role = useMemberRole(slug);
  return (
    <PublicProjectPageView
      key={`${slug ?? ""}:${role ?? "public"}:${currentUser?.uid ?? ""}`}
      services={services}
      role={role}
      currentUser={currentUser}
    />
  );
}
