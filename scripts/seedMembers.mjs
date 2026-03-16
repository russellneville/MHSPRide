/**
 * seedMembers.mjs
 *
 * Seeds the Firestore `members` collection from the geocoded roster CSV.
 *
 * Prerequisites:
 *   - Place your Firebase service account key at scripts/serviceAccountKey.json
 *     (obtain from Google Cloud Console > IAM & Admin > Service Accounts)
 *   - npm install --save-dev csv-parse firebase-admin
 *
 * Usage:
 *   node scripts/seedMembers.mjs
 */

import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// NOTE: You must provide this file. See scripts/README.md for instructions.
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const CSV_PATH = new URL(
  "../resources/mhsp-roster-geocoded-blank-free.csv",
  import.meta.url
).pathname;

async function main() {
  const records = [];

  await new Promise((resolve, reject) => {
    createReadStream(CSV_PATH)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on("data", (row) => records.push(row))
      .on("end", resolve)
      .on("error", reject);
  });

  const members = records.filter((r) => r["MHSP Number"] && r["MHSP Number"].trim() !== "");

  console.log(`Parsed ${records.length} rows, ${members.length} with MHSP numbers.`);

  const BATCH_SIZE = 500;
  let written = 0;

  for (let i = 0; i < members.length; i += BATCH_SIZE) {
    const chunk = members.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const row of chunk) {
      const mhspNumber = row["MHSP Number"].trim();
      const classifications = row["Classifications"]
        ? row["Classifications"].split(",").map((c) => c.trim()).filter(Boolean)
        : [];

      const latRaw = row["latitude"];
      const lonRaw = row["longitude"];

      const docRef = db.collection("members").doc(mhspNumber);
      batch.set(docRef, {
        lastName: row["Last Name"] ?? "",
        firstName: row["First Name"] ?? "",
        email: row["Email"] ?? "",
        mhspNumber,
        classifications,
        latitude: latRaw ? parseFloat(latRaw) : null,
        longitude: lonRaw ? parseFloat(lonRaw) : null,
        address: row["Addresses"] ?? "",
        status: row["Status"] ?? "",
        active: true,
        claimed: false,
        claimedBy: null,
      });
    }

    await batch.commit();
    written += chunk.length;
    console.log(`Written ${written}/${members.length} members...`);
  }

  console.log(`Done. Seeded ${written} member documents.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
