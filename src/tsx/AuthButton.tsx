import type { ComponentProps } from "react";
import { useAuth } from "../auth";
import { AuthButtonView } from "./AuthButtonView";

export function AuthButton(
  props: Omit<ComponentProps<typeof AuthButtonView>, "currentUser">,
) {
  const { currentUser } = useAuth();
  return <AuthButtonView {...props} currentUser={currentUser} />;
}
