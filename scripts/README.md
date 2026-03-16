# MHSPRide Scripts

These scripts manage Firestore data for MHSPRide using the Firebase Admin SDK.

## Prerequisites

### 1. Firebase service account key

The scripts authenticate with Firebase using a service account key file. You must obtain this file and place it at `scripts/serviceAccountKey.json` before running any script.

**How to obtain a service account key:**

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your Firebase project.
3. Navigate to **IAM & Admin > Service Accounts**.
4. Locate the service account for your Firebase project (typically `firebase-adminsdk-...@<project-id>.iam.gserviceaccount.com`).
5. Click the three-dot menu for that account and choose **Manage keys**.
6. Click **Add Key > Create new key**, select **JSON**, and click **Create**.
7. Save the downloaded file as `scripts/serviceAccountKey.json`.

`serviceAccountKey.json` is listed in `.gitignore` and will not be committed to the repository.

### 2. Node dependencies

From the project root, install dependencies if you haven't already:

```bash
npm install
```

---

## Scripts

### `seedMembers.mjs`

Seeds the `members` Firestore collection from the geocoded roster CSV (`resources/mhsp-roster-geocoded-blank-free.csv`). Only rows with an MHSP Number are imported.

```bash
node scripts/seedMembers.mjs
```

### `seedNetworks.mjs`

Creates the three network documents in the `networks` collection (Hill Patrol, Mountain Hosts, Nordic Patrol). This script is idempotent — it skips documents that already exist.

```bash
node scripts/seedNetworks.mjs
```

### `diffRoster.mjs`

Compares two roster CSV files by MHSP Number and outputs a JSON diff report to stdout. Redirect to a file for use with `syncMembers.mjs`.

```bash
node scripts/diffRoster.mjs \
  --previous resources/mhsp-roster-geocoded-blank-free.csv \
  --new resources/mhsp-roster-geocoded-blank-free-new.csv \
  > diff-report.json
```

Output format:
```json
{
  "added": ["1234"],
  "removed": ["5678"],
  "changed": [
    {
      "mhspNumber": "9999",
      "changes": {
        "Status": { "old": "Active", "new": "Alumni" }
      }
    }
  ]
}
```

### `syncMembers.mjs`

Applies a diff report to Firestore. Added members are created, changed members are updated (preserving `claimed` and `claimedBy`), and removed members are marked `active: false` (never deleted).

```bash
node scripts/syncMembers.mjs \
  --diff diff-report.json \
  --csv resources/mhsp-roster-geocoded-blank-free-new.csv
```
