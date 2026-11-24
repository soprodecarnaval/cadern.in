import { useParams } from "react-router-dom";
import { useAuth } from "../../../../auth";
import * as db from "../../../../lib/db";
import { loadPinnedScores } from "../../../../lib/songbookScores";
import { useMemberRole } from "../../../../lib/useMemberRole";
import { PublicProjectPageView } from "./PublicProjectPageView";

const services = { ...db, loadPinnedScores };

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
