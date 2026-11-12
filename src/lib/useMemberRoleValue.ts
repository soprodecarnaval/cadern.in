import { useEffect, useState } from "react";
import type { Role } from "./roles";

export function useMemberRoleValue(
  slug: string | undefined,
  uid: string | undefined,
  getRole: (slug: string, uid: string) => Promise<Role>,
): Role | "loading" {
  const [role, setRole] = useState<Role | "loading">("loading");
  useEffect(() => {
    if (!slug || !uid) {
      setRole(undefined);
      return;
    }
    setRole("loading");
    void getRole(slug, uid).then(setRole);
  }, [slug, uid, getRole]);
  return role;
}
