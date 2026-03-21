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
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  updateAvatar: (blob: Blob) => Promise<void>;
  changePassword: (current: string, newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setCurrentUser);
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
    setCurrentUser({ ...user, displayName });
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
    const credential = EmailAuthProvider.credential(auth.currentUser!.email!, current);
    await reauthenticateWithCredential(auth.currentUser!, credential);
    await firebaseUpdatePassword(auth.currentUser!, newPass);
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, resetPassword, register, updateDisplayName, updateAvatar, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
