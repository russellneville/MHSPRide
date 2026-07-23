'use client'
import { ChevronRight, MoveRight } from "lucide-react"
import { formatDate, formatTime } from "@/lib/utils"
import { resolveLocation } from "@/lib/locations"

/**
 * Compact ride summary shown in place of a table row on small screens.
 * `details` and `badges` render as-is; the card is clickable when `onClick`
 * is set, showing a chevron unless a custom `action` is provided.
 */
export default function RideRowCard({ departure, arrival, date, time, details, badges, onClick, highlight, action }) {
  return (
    <div
      onClick={onClick}
      className={`border border-border rounded-lg p-3 space-y-1.5 ${onClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''} ${highlight ? 'bg-blue-50 dark:bg-blue-950' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-sm flex items-center gap-1.5 min-w-0">
          <span className="truncate">{resolveLocation(departure)}</span>
          <MoveRight className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{resolveLocation(arrival)}</span>
        </div>
        {action ?? (onClick && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />)}
      </div>
      <p className="text-sm text-muted-foreground">
        {formatDate(date)}{time ? ` at ${formatTime(time)}` : ''}
      </p>
      {details}
      {badges && <div className="flex flex-wrap gap-1.5">{badges}</div>}
    </div>
  )
}
