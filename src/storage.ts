const FIREBASE_STORAGE_BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;

export function storagePathToUrl(storagePath: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${storagePath}?alt=media`;
}
