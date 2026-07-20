export const COOKIE_CONSENT_STORAGE_KEY = 'mhspride_cookie_consent'
export const COOKIE_CONSENT_CHANGED_EVENT = 'cookie-consent-changed'

export function hasAnalyticsConsent() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === 'necessary+analytics'
}
