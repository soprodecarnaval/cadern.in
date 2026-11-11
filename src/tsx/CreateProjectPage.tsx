import { useAuth } from "../auth";
import * as services from "../lib/db";
import { CreateProjectPageView } from "./CreateProjectPageView";

export function CreateProjectPage() {
  const { currentUser } = useAuth();
  return (
    <CreateProjectPageView services={services} currentUser={currentUser} />
  );
}
