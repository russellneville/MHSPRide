/**
 * Refuses to run against anything but the test Firebase project.
 * Guards seedTestData.mjs / clearTestData.mjs, which write/delete data in bulk
 * and must never point at production by way of a stale or misconfigured
 * scripts/serviceAccountKey.json.
 */
const ALLOWED_PROJECT_ID = 'mhspride-test'

export function assertTestProject(serviceAccount) {
  if (serviceAccount.project_id !== ALLOWED_PROJECT_ID) {
    console.error(`❌  serviceAccountKey.json points at project "${serviceAccount.project_id}", not "${ALLOWED_PROJECT_ID}".`)
    console.error('    Refusing to run — this script must only run against the test Firebase project.')
    console.error('    Download the correct key from the mhspride-test project in the Firebase console.')
    process.exit(1)
  }
}
