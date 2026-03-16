/**
 * syncMembers.mjs
 *
 * Applies a diff report (from diffRoster.mjs) to the Firestore `members` collection.
 *
 * Prerequisites:
 *   - Place your Firebase service account key at scripts/serviceAccountKey.json
 *     (obtain from Google Cloud Console > IAM & Admin > Service Accounts)
 *   - npm install --save-dev csv-parse firebase-admin
 *
 * Usage:
 *   node scripts/syncMembers.mjs --diff <path-to-diff.json> --csv <path-to-new-roster.csv>
 */

import { createReadStream, readFileSync } from "fs";
import { parse } from "csv-parse";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// NOTE: You must provide this file. See scripts/README.md for instructions.
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--diff" && args[i + 1]) result.diff = args[++i];
    else if (args[i] === "--csv" && args[i + 1]) result.csv = args[++i];
  }
  if (!result.diff || !result.csv) {
    console.error(
      "Usage: node scripts/syncMembers.mjs --diff <path> --csv <path>"
    );
    process.exit(1);
  }
  return result;
}

async function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const records = {};
    createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on("data", (row) => {
        const id = row["MHSP Number"]?.trim();
        if (id) records[id] = row;
      })
      .on("end", () => resolve(records))
      .on("error", reject);
  });
}

function rowToMemberDoc(row) {
  const mhspNumber = row["MHSP Number"].trim();
  const classifications = row["Classifications"]
    ? row["Classifications"].split(",").map((c) => c.trim()).filter(Boolean)
    : [];
  const latRaw = row["latitude"];
  const lonRaw = row["longitude"];

  return {
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
  };
}

async function main() {
  const args = parseArgs();

  const diff = JSON.parse(readFileSync(args.diff, "utf-8"));
  const csvRecords = await readCsv(args.csv);

  const BATCH_SIZE = 500;
  let addedCount = 0;
  let changedCount = 0;
  let removedCount = 0;

  // Process added records
  const addedIds = diff.added ?? [];
  for (let i = 0; i < addedIds.length; i += BATCH_SIZE) {
    const chunk = addedIds.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const mhspNumber of chunk) {
      const row = csvRecords[mhspNumber];
      if (!row) {
        console.warn(`Warning: added MHSP number ${mhspNumber} not found in CSV, skipping.`);
        continue;
      }
      const docRef = db.collection("members").doc(mhspNumber);
      batch.set(docRef, {
        ...rowToMemberDoc(row),
        claimed: false,
        claimedBy: null,
      });
      addedCount++;
    }
    await batch.commit();
  }

  // Process changed records (update all fields except claimed and claimedBy)
  const changedItems = diff.changed ?? [];
  const changedIds = changedItems.map((c) => c.mhspNumber);
  for (let i = 0; i < changedIds.length; i += BATCH_SIZE) {
    const chunk = changedIds.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const mhspNumber of chunk) {
      const row = csvRecords[mhspNumber];
      if (!row) {
        console.warn(`Warning: changed MHSP number ${mhspNumber} not found in CSV, skipping.`);
        continue;
      }
      const docRef = db.collection("members").doc(mhspNumber);
      // Update all fields except claimed and claimedBy
      batch.update(docRef, rowToMemberDoc(row));
      changedCount++;
    }
    await batch.commit();
  }

  // Process removed records (set active: false, never delete)
  const removedIds = diff.removed ?? [];
  for (let i = 0; i < removedIds.length; i += BATCH_SIZE) {
    const chunk = removedIds.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const mhspNumber of chunk) {
      const docRef = db.collection("members").doc(mhspNumber);
      batch.update(docRef, { active: false });
      removedCount++;
    }
    await batch.commit();
  }

  console.log("Sync complete.");
  console.log(`  Added:   ${addedCount}`);
  console.log(`  Updated: ${changedCount}`);
  console.log(`  Removed: ${removedCount} (marked inactive)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
