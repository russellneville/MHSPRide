// Single source of truth for the carpooling networks. Networks are fixed
// categories, not Firestore-backed memberships — users "favorite" them
// (users/{uid}.favorite_networks, an ordered array of ids) to control which
// groups appear on their dashboard.

export const NETWORKS = [
  { id: "network-HILLPATROL",     name: "Hill Patrol",     description: "Alpine ski patrollers on the main mountain." },
  { id: "network-MOUNTAINHOSTS",  name: "Mountain Hosts",  description: "Volunteer hosts welcoming guests at Timberline." },
  { id: "network-NORDIC",         name: "Nordic Patrol",   description: "Nordic and backcountry patrol volunteers." },
  { id: "network-MOUNTAINBIKING", name: "Mountain Biking", description: "Timberline bike park shifts for bike patrollers and hosts." },
]

export const NETWORK_IDS = NETWORKS.map(n => n.id)

export function networkName(id) {
  return NETWORKS.find(n => n.id === id)?.name || id
}

// Troopiter roster classification → default favorite network (issue #69)
const CLASSIFICATION_DEFAULTS = {
  "Associate Apprentice":        "network-HILLPATROL",
  "Associate Patroller":         "network-HILLPATROL",
  "Associate Supervisor":        "network-HILLPATROL",
  "Bike Apprentice":             "network-MOUNTAINBIKING",
  "Bike Patroller":              "network-MOUNTAINBIKING",
  "Hill Apprentice":             "network-HILLPATROL",
  "Hill Captain":                "network-HILLPATROL",
  "Hill Patroller":              "network-HILLPATROL",
  "Host Supervisor":             "network-MOUNTAINHOSTS",
  "Mountain Host":               "network-MOUNTAINHOSTS",
  "Mountain Host Apprentice":    "network-MOUNTAINHOSTS",
  "NSP Senior":                  "network-HILLPATROL",
  "Nordic Apprentice":           "network-NORDIC",
  "Nordic Patroller":            "network-NORDIC",
  "Paid Patroller":              "network-HILLPATROL",
  "Returning Member":            "network-HILLPATROL",
  "Senior Associate Supervisor": "network-HILLPATROL",
  "Senior Hill Captain":         "network-HILLPATROL",
  "Ski Patrol Youth":            "network-HILLPATROL",
  "Transfer Patroller":          "network-HILLPATROL",
}

/**
 * Default favorite networks for a user's roster classifications, in NETWORKS
 * display order. Returns [] when nothing matches (caller decides the fallback).
 */
export function defaultFavoritesFor(classifications) {
  const ids = new Set(
    (classifications || [])
      .map(c => CLASSIFICATION_DEFAULTS[String(c).trim()])
      .filter(Boolean)
  )
  return NETWORK_IDS.filter(id => ids.has(id))
}
