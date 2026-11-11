import { useAuth } from "../auth";
import * as services from "../lib/db";
import { MyScoresPageView } from "./MyScoresPageView";

export function MyScoresPage() {
  const { currentUser } = useAuth();
  return <MyScoresPageView services={services} currentUser={currentUser} />;
}
