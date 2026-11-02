import { DocumentReference, type Firestore } from "firebase-admin/firestore";

export interface CloneMapping {
  sourceBucket: string;
  targetBucket: string;
  sourceUid: string;
  targetUid: string;
}

export function clonePath(path: string, mapping: CloneMapping): string {
  return path.split("/").map((part) => part === mapping.sourceUid ? mapping.targetUid : part).join("/");
}

export function cloneValue(value: unknown, mapping: CloneMapping, targetDb: Firestore): unknown {
  if (typeof value === "string") {
    if (value === mapping.sourceUid) return mapping.targetUid;
    const firebasePrefix = `https://firebasestorage.googleapis.com/v0/b/${mapping.sourceBucket}/`;
    if (value.startsWith(firebasePrefix)) {
      return value.replace(firebasePrefix, `https://firebasestorage.googleapis.com/v0/b/${mapping.targetBucket}/`);
    }
    for (const prefix of ["gs://", "https://storage.googleapis.com/"]) {
      if (value.startsWith(`${prefix}${mapping.sourceBucket}/`)) {
        return value.replace(`${prefix}${mapping.sourceBucket}/`, `${prefix}${mapping.targetBucket}/`);
      }
    }
    return value;
  }
  if (value instanceof DocumentReference) return targetDb.doc(clonePath(value.path, mapping));
  if (Array.isArray(value)) return value.map((item) => cloneValue(item, mapping, targetDb));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key === mapping.sourceUid ? mapping.targetUid : key,
      cloneValue(item, mapping, targetDb),
    ]));
  }
  return value;
}
