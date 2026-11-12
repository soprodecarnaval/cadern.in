import { useAuth } from "../auth";
import { AuthModalView } from "./AuthModalView";

export function AuthModal(props: { show: boolean; onHide: () => void }) {
  const {
    login,
    register,
    resetPassword,
    pendingUser,
    resendVerificationEmail,
    refreshVerificationStatus,
    signInWithGoogle,
    logout,
  } = useAuth();
  return (
    <AuthModalView
      {...props}
      login={login}
      register={register}
      resetPassword={resetPassword}
      pendingUser={pendingUser}
      resendVerificationEmail={resendVerificationEmail}
      refreshVerificationStatus={refreshVerificationStatus}
      signInWithGoogle={signInWithGoogle}
      logout={logout}
    />
  );
}
