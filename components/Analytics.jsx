'use client'
import { useEffect, useState } from "react"
import { GoogleAnalytics } from "@next/third-parties/google"
import { hasAnalyticsConsent, COOKIE_CONSENT_CHANGED_EVENT } from "@/lib/cookieConsent"

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export default function Analytics() {
  const [consented, setConsented] = useState(false)

  useEffect(() => {
    setConsented(hasAnalyticsConsent())

    const onConsentChanged = () => setConsented(hasAnalyticsConsent())
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, onConsentChanged)
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, onConsentChanged)
  }, [])

  if (!consented || !GA_MEASUREMENT_ID || process.env.NODE_ENV !== 'production') return null

  return <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />
}
