export const COOKIE_CONSENT_STORAGE_KEY = 'mhspride_cookie_consent'
export const COOKIE_CONSENT_CHANGED_EVENT = 'cookie-consent-changed'

// Opt-out model: analytics is on by default. Only an explicit 'necessary' choice opts out.
export function hasAnalyticsConsent() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) !== 'necessary'
}
