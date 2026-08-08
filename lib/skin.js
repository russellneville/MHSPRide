// Hostname -> skin mapping for the Troopiter integration prototype (issue
// #199). troopiter.mhspride.com stands in for the eventual carpool.troopiter.com
// until Troopiter's own DNS is configured — an allowlist rather than a single
// hardcoded domain so cutover is swapping one entry, not new logic
// (resources/troopiter/integration-proposal.md, "Testing before
// carpool.troopiter.com is configured").
const TROOPITER_HOSTS = ['troopiter.mhspride.com', 'carpool.troopiter.com']

export function resolveSkin(host) {
  const hostname = (host || '').split(':')[0].toLowerCase()
  return TROOPITER_HOSTS.includes(hostname) ? 'troopiter' : 'mhsp'
}

// Single hardcoded org for this rehearsal prototype — the multi-tenant
// organizations/{orgId}/... restructure described in the proposal is
// explicitly out of scope until a second patrol actually onboards.
export const TROOPITER_ORG_ID = 'armadillo-mountain'

// The product's own name is white-labeled per skin, same as the org logo —
// "MHSP Ride" is Mount Hood Ski Patrol's own name for the product, not the
// product's name in general. For Troopiter-skinned orgs, "Troopiter Ride" is
// only a fallback default — admins can override it per-org (Organizations
// admin page -> organizations/{orgId}.productName) without a code change.
export function productName(skin, org) {
  return skin === 'troopiter' ? (org?.productName || 'Troopiter Ride') : 'MHSP Ride'
}
