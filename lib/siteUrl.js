/**
 * Central source of truth for which public domain and "TEST" labeling this
 * server should use in outbound emails. The `test` branch deployment runs
 * against the `mhspride-test` Firebase project and is aliased to
 * test.mhspride.com; everything else (production, local dev — which also
 * defaults to mhspride-test) targets mhspride.com. See README's
 * "Test / UAT environment" section.
 */
export const IS_TEST_ENV = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'mhspride-test'
export const SITE_URL = IS_TEST_ENV ? 'https://test.mhspride.com' : 'https://mhspride.com'
