import { useAuth } from "../auth";
import * as services from "../lib/db";
import { MeusProjetosPageView } from "./MeusProjetosPageView";

export function MeusProjetosPage() {
  const { currentUser } = useAuth();
  return <MeusProjetosPageView services={services} currentUser={currentUser} />;
}
