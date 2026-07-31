import { useState } from "react"
import Image from "next/image"
import { Sparkles, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { badgeImagePath } from "@/lib/badges/catalog"
import {
  AlertDialog, AlertDialogAction, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// A deterministic confetti-burst ring (not Math.random()) so the animation
// is reproducible and there's no client/server render mismatch risk.
const CONFETTI_COLORS = ["#f59e0b", "#ec4899", "#38bdf8", "#a855f7", "#22c55e"]
const CONFETTI_PIECES = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * 2 * Math.PI
  const radius = 60 + (i % 3) * 12
  return {
    tx: Math.round(Math.cos(angle) * radius),
    ty: Math.round(Math.sin(angle) * radius),
    rotate: (i * 47) % 360,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: (i % 4) * 0.06,
  }
})

// Celebration dialog for newly-earned badges. Steps through `badges` one at a
// time with a next arrow (components/CancelReasonDialog.jsx is the only other
// multi-step AlertDialog in the app — this follows the same step-state shape).
// Named AchievementBadge, not Badge, to avoid colliding with the status-pill
// component at components/ui/badge.jsx.
export default function AchievementBadge({ open, onOpenChange, badges, onAcknowledge }) {
  const [index, setIndex] = useState(0)

  function handleOpenChange(next) {
    if (!next) setIndex(0)
    onOpenChange(next)
  }

  if (!badges?.length) return null

  const badge = badges[index]
  const isLast = index === badges.length - 1

  function handleNext(e) {
    e.preventDefault()
    onAcknowledge?.(badge.id)
    setIndex((i) => i + 1)
  }

  function handleDone() {
    onAcknowledge?.(badge.id)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader className="items-center text-center">
          <div key={`${badge.id}-${index}`} className="achievement-burst">
            <span className="achievement-glow" aria-hidden="true" />
            <div className="achievement-confetti" aria-hidden="true">
              {CONFETTI_PIECES.map((p, i) => (
                <span
                  key={i}
                  className="achievement-confetti-piece"
                  style={{
                    "--tx": `${p.tx}px`,
                    "--ty": `${p.ty}px`,
                    "--rot": `${p.rotate}deg`,
                    backgroundColor: p.color,
                    animationDelay: `${p.delay}s`,
                  }}
                />
              ))}
            </div>
            <Sparkles className="achievement-sparkle achievement-sparkle-1" aria-hidden="true" />
            <Star className="achievement-sparkle achievement-sparkle-2" aria-hidden="true" />
            <Sparkles className="achievement-sparkle achievement-sparkle-3" aria-hidden="true" />
            {/* White padded card, rounded — the art runs edge-to-edge with
                text near the corners, so rounding the image itself clips it. */}
            <div className="achievement-badge-image mx-auto bg-white rounded-xl p-2.5 shadow-sm">
              <Image
                src={badgeImagePath(badge)}
                alt={badge.name}
                width={160}
                height={160}
              />
            </div>
          </div>
          <AlertDialogTitle>{badge.name}</AlertDialogTitle>
          <AlertDialogDescription>{badge.earnedDescription}</AlertDialogDescription>
          {badges.length > 1 && (
            <p className="text-xs text-muted-foreground">
              {index + 1} of {badges.length}
            </p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {isLast ? (
            <AlertDialogAction onClick={handleDone}>Nice!</AlertDialogAction>
          ) : (
            <Button onClick={handleNext}>Next →</Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
