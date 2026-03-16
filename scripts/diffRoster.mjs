/**
 * diffRoster.mjs
 *
 * Compares two geocoded roster CSV files and outputs a JSON diff report to stdout.
 *
 * Usage:
 *   node scripts/diffRoster.mjs --previous <path> --new <path>
 *
 * Output format (JSON to stdout):
 * {
 *   "added": ["1234", ...],          // MHSP numbers present in new but not previous
 *   "removed": ["5678", ...],        // MHSP numbers no longer present in new
 *   "changed": [                     // MHSP numbers present in both with field differences
 *     {
 *       "mhspNumber": "1234",
 *       "changes": {
 *         "fieldName": { "old": "...", "new": "..." }
 *       }
 *     }
 *   ]
 * }
 */

import { createReadStream } from "fs";
import { parse } from "csv-parse";

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--previous" && args[i + 1]) result.previous = args[++i];
    else if (args[i] === "--new" && args[i + 1]) result.new = args[++i];
  }
  if (!result.previous || !result.new) {
    console.error("Usage: node scripts/diffRoster.mjs --previous <path> --new <path>");
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

async function main() {
  const args = parseArgs();

  const [prevRecords, newRecords] = await Promise.all([
    readCsv(args.previous),
    readCsv(args.new),
  ]);

  const prevIds = new Set(Object.keys(prevRecords));
  const newIds = new Set(Object.keys(newRecords));

  const added = [...newIds].filter((id) => !prevIds.has(id));
  const removed = [...prevIds].filter((id) => !newIds.has(id));

  const changed = [];
  for (const id of [...prevIds].filter((id) => newIds.has(id))) {
    const oldRow = prevRecords[id];
    const newRow = newRecords[id];
    const allKeys = new Set([...Object.keys(oldRow), ...Object.keys(newRow)]);
    const changes = {};

    for (const key of allKeys) {
      const oldVal = oldRow[key] ?? "";
      const newVal = newRow[key] ?? "";
      if (oldVal !== newVal) {
        changes[key] = { old: oldVal, new: newVal };
      }
    }

    if (Object.keys(changes).length > 0) {
      changed.push({ mhspNumber: id, changes });
    }
  }

  const report = { added, removed, changed };
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
