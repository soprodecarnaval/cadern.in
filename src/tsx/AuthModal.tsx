import { useAuth } from "../auth";
import { AuthModalView } from "./AuthModalView";

export function AuthModal(props: { show: boolean; onHide: () => void }) {
  const { login, register, resetPassword } = useAuth();
  return (
    <AuthModalView
      {...props}
      login={login}
      register={register}
      resetPassword={resetPassword}
    />
  );
}
