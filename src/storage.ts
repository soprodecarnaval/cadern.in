const BUCKET = import.meta.env.FIREBASE_STORAGE_BUCKET;

export function storagePathToUrl(storagePath: string): string {
  const encoded = encodeURIComponent(storagePath).replace(/%2F/g, "%2F");
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}?alt=media`;
}
