'use client'
import { useEffect } from "react"
import { GoogleAnalytics } from "@next/third-parties/google"
import { hasAnalyticsConsent, COOKIE_CONSENT_CHANGED_EVENT } from "@/lib/cookieConsent"

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

function pushConsentUpdate() {
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(['consent', 'update', {
    analytics_storage: hasAnalyticsConsent() ? 'granted' : 'denied',
  }])
}

export default function Analytics() {
  useEffect(() => {
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, pushConsentUpdate)
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, pushConsentUpdate)
  }, [])

  if (!GA_MEASUREMENT_ID || process.env.NODE_ENV !== 'production') return null

  return <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />
}
