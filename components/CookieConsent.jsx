'use client'
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Cookie, X } from "lucide-react"

const STORAGE_KEY = 'mhspride_cookie_consent'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) setVisible(true)
  }, [])

  const accept = (level) => {
    localStorage.setItem(STORAGE_KEY, level)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto rounded-xl border border-border bg-card shadow-2xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">

        <Cookie className="size-6 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">This site uses cookies</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            We use essential cookies to keep the site running. With your permission, we also use analytics cookies to understand how the site is used so we can improve it. No data is sold or shared with third parties.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => accept('necessary')}
          >
            Necessary only
          </Button>
          <Button
            size="sm"
            className="text-xs h-8"
            onClick={() => accept('necessary+analytics')}
          >
            Accept all
          </Button>
          <button
            onClick={() => accept('necessary+analytics')}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>

      </div>
    </div>
  )
}
