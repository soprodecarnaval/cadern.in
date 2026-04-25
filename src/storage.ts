const FIREBASE_STORAGE_BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;

export function storagePathToUrl(storagePath: string): string {
  const encoded = encodeURIComponent(storagePath).replace(/%2F/g, "%2F");
  return `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encoded}?alt=media`;
}
