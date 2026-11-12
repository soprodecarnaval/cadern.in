import { useParams } from "react-router-dom";
import * as services from "../lib/db";
import { useMemberRole } from "../lib/useMemberRole";
import { PublicProjectPageView } from "./PublicProjectPageView";

export function PublicProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const role = useMemberRole(slug);
  return <PublicProjectPageView services={services} role={role} />;
}
