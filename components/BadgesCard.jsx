import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { badgeById, badgeImagePath } from "@/lib/badges/catalog"

// Badges section (resources/badging.md). Takes the caller's earned badge docs
// (users/{uid}/badges/*: { badgeId, earnedAt }) and resolves each against the
// catalog for display. Two modes:
// - Editable (Profile page, onToggleHideBadges passed): shows the hide_badges
//   and hide_badge_notifications checkboxes (independent — see issue #177)
//   and collapses the grid when hideBadges is checked. The parent page owns
//   persisting both and replaying any missed celebration dialog when
//   notifications are unhidden.
// - Read-only (admin viewing another member, no onToggleHideBadges): no
//   checkboxes, always shows the real grid regardless of that member's own
//   hide_badges — an admin needs to see what was actually earned, not the
//   member's own display preference for it.
export default function BadgesCard({
  badges = [],
  hideBadges = false,
  hideNotifications = false,
  onToggleHideBadges,
  onToggleHideNotifications,
  className,
}) {
  const editable = typeof onToggleHideBadges === "function"
  const earned = badges
    .map((award) => ({ award, badge: badgeById(award.badgeId) }))
    .filter(({ badge }) => badge) // drop ids the catalog no longer defines

  return (
    <Card className={className}>
      <CardHeader className="!pb-3 border-b border-border">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle>Badges</CardTitle>
          {editable && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="hide-badges"
                  checked={hideBadges}
                  onCheckedChange={(checked) => onToggleHideBadges(!!checked)}
                />
                <Label htmlFor="hide-badges" className="font-normal text-sm text-muted-foreground">
                  Hide badges on my profile
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="hide-badge-notifications"
                  checked={hideNotifications}
                  onCheckedChange={(checked) => onToggleHideNotifications(!!checked)}
                />
                <Label htmlFor="hide-badge-notifications" className="font-normal text-sm text-muted-foreground">
                  Hide badge notifications
                </Label>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editable && hideBadges ? (
          <p className="text-muted-foreground text-sm">
            Badges are hidden. Uncheck the box above to see your progress again.
          </p>
        ) : earned.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No badges yet — they show up here as you use MHSP Ride.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
            {earned.map(({ award, badge }) => (
              <div key={award.badgeId} className="flex flex-col items-center text-center gap-1">
                {/* White padded card, rounded — the art runs edge-to-edge with
                    text near the corners, so rounding the image itself clips it. */}
                <div className="bg-white rounded-lg p-1.5 shadow-sm">
                  <Image src={badgeImagePath(badge)} alt={badge.name} width={64} height={64} />
                </div>
                <p className="text-xs font-medium text-foreground">{badge.name}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
