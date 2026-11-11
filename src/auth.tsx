import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword as firebaseUpdatePassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, storage } from "./firebase";

interface AuthContextValue {
  currentUser: User | null;
  pendingUser: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  updateAvatar: (blob: Blob) => Promise<void>;
  changePassword: (current: string, newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // A signed-in Firebase user whose email isn't verified yet is not
  // considered logged in: currentUser stays null, and the raw user sits in
  // pendingUser so the UI can show a "verify your email" screen with resend.
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !user.emailVerified) {
        setCurrentUser(null);
        setPendingUser(user);
      } else {
        setCurrentUser(user);
        setPendingUser(null);
      }
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const register = async (
    email: string,
    password: string,
    displayName: string,
  ) => {
    const { user } = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    await updateProfile(user, { displayName });
    await sendEmailVerification(user);
    setPendingUser({ ...user });
  };

  const resendVerificationEmail = async () => {
    if (!pendingUser) {return;}
    await sendEmailVerification(pendingUser);
  };

  const refreshVerificationStatus = async () => {
    if (!auth.currentUser) {return;}
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) {
      setCurrentUser(auth.currentUser);
      setPendingUser(null);
    }
  };

  const updateDisplayName = async (name: string) => {
    await updateProfile(auth.currentUser!, { displayName: name });
    setCurrentUser({ ...auth.currentUser!, displayName: name });
  };

  const updateAvatar = async (blob: Blob) => {
    const storageRef = ref(storage, `avatars/${auth.currentUser!.uid}`);
    await uploadBytes(storageRef, blob);
    const photoURL = await getDownloadURL(storageRef);
    await updateProfile(auth.currentUser!, { photoURL });
    setCurrentUser({ ...auth.currentUser!, photoURL });
  };

  const changePassword = async (current: string, newPass: string) => {
    const credential = EmailAuthProvider.credential(
      auth.currentUser!.email!,
      current,
    );
    await reauthenticateWithCredential(auth.currentUser!, credential);
    await firebaseUpdatePassword(auth.currentUser!, newPass);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        pendingUser,
        login,
        logout,
        resetPassword,
        register,
        resendVerificationEmail,
        refreshVerificationStatus,
        updateDisplayName,
        updateAvatar,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
