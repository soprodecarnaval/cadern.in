import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { getMemberRole } from "./db";
import type { Role } from "./roles";

/** The signed-in user's role in `slug`; `"loading"` until it is known. */
export function useMemberRole(slug: string | undefined): Role | "loading" {
  const { currentUser } = useAuth();
  const [role, setRole] = useState<Role | "loading">("loading");

  useEffect(() => {
    if (!slug || !currentUser) {
      setRole(undefined);
      return;
    }
    setRole("loading");
    void getMemberRole(slug, currentUser.uid).then(setRole);
  }, [slug, currentUser]);

  return role;
}
