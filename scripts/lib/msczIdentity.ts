import fs from "node:fs";
import path from "node:path";
import {
  readMsczIdentityBytes,
  stampMsczIdentityBytes,
} from "../../src/lib/msczIdentity";
import type { ScoreIdentity } from "../../types/metajson";

// Node wrappers over the browser-safe implementation in src/lib/msczIdentity.
const bytesOf = (mscz: string | Buffer): Uint8Array =>
  typeof mscz === "string" ? fs.readFileSync(mscz) : mscz;

/** `null` when the file was never stamped or carries only part of the ids. */
export const readMsczIdentity = (
  mscz: string | Buffer,
): ScoreIdentity | null => readMsczIdentityBytes(bytesOf(mscz));

/** The same archive with the identity written into its root score. */
export const stampMsczIdentity = (
  mscz: string | Buffer,
  identity: ScoreIdentity,
): Buffer => Buffer.from(stampMsczIdentityBytes(bytesOf(mscz), identity));

/** Stamps a file in place; a failure leaves the original untouched. */
export const stampMsczFile = (
  msczPath: string,
  identity: ScoreIdentity,
): void => {
  const stamped = stampMsczIdentity(msczPath, identity);
  const temporaryPath = path.join(
    path.dirname(msczPath),
    `.${path.basename(msczPath)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    fs.writeFileSync(temporaryPath, stamped);
    fs.renameSync(temporaryPath, msczPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
};
