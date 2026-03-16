/**
 * seedNetworks.mjs
 *
 * Seeds the Firestore `networks` collection with the three MHSPRide networks.
 * This script is idempotent — it checks for existing documents before writing.
 *
 * Prerequisites:
 *   - Place your Firebase service account key at scripts/serviceAccountKey.json
 *     (obtain from Google Cloud Console > IAM & Admin > Service Accounts)
 *   - npm install --save-dev firebase-admin
 *
 * Usage:
 *   node scripts/seedNetworks.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// NOTE: You must provide this file. See scripts/README.md for instructions.
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const NETWORKS = [
  {
    id: "network-HILLPATROL",
    name: "Hill Patrol",
    description: "Mount Hood Ski Patrol Hill Patrollers",
    inviteCode: "MHSP-HP",
  },
  {
    id: "network-MOUNTAINHOSTS",
    name: "Mountain Hosts",
    description: "Mount Hood Mountain Hosts",
    inviteCode: "MHSP-MH",
  },
  {
    id: "network-NORDIC",
    name: "Nordic Patrol",
    description: "Mount Hood Ski Patrol Nordic Patrollers",
    inviteCode: "MHSP-NP",
  },
];

async function main() {
  for (const network of NETWORKS) {
    const { id, ...fields } = network;
    const docRef = db.collection("networks").doc(id);
    const existing = await docRef.get();

    if (existing.exists) {
      console.log(`Skipping ${id} — already exists.`);
      continue;
    }

    await docRef.set({
      ...fields,
      passengers: [],
      drivers: [],
      passengersIds: [],
      driversIds: [],
      created_at: FieldValue.serverTimestamp(),
    });

    console.log(`Created ${id}.`);
  }

  console.log("Done seeding networks.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
