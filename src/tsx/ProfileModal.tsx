import type { ComponentProps } from "react";
import { useMemo } from "react";
import { useAuth } from "../auth";
import * as db from "../lib/db";
import { ProfileModalView } from "./ProfileModalView";

export function ProfileModal(
  props: Omit<
    ComponentProps<typeof ProfileModalView>,
    "services" | "currentUser"
  >,
) {
  const {
    currentUser,
    updateDisplayName,
    updateAvatar,
    changePassword,
    logout,
  } = useAuth();
  const services = useMemo(
    () => ({ ...db, updateDisplayName, updateAvatar, changePassword, logout }),
    [updateDisplayName, updateAvatar, changePassword, logout],
  );
  return (
    <ProfileModalView
      {...props}
      services={services}
      currentUser={currentUser}
    />
  );
}
