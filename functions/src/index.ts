import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions";

initializeApp();

// Same region as Firestore (firebase.json). `maxInstances` caps cost under
// unexpected traffic; override per function where needed.
setGlobalOptions({ region: "southamerica-east1", maxInstances: 10 });

export { findUserForInvite } from "./findUserForInvite";
