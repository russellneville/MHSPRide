'use client'
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Users } from "lucide-react"
import { useNetwork } from "@/context/NetworksContext"
import { usePopup } from "@/context/PopupContext"
import { NETWORKS } from "@/lib/networks"

// Dialog listing the not-yet-favorited networks so the user can add one to
// their dashboard. Favoriting appends to the end of the existing order.
export default function AddFavoritePopup({ favorites }) {
  const { saveFavorites } = useNetwork()
  const { closePopup } = usePopup()
  const [savingId, setSavingId] = useState(null)

  const remaining = NETWORKS.filter(n => !favorites.includes(n.id))

  const handleAdd = async (networkId) => {
    setSavingId(networkId)
    const ok = await saveFavorites([...favorites, networkId])
    setSavingId(null)
    if (ok) closePopup()
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Favorited networks show their available rides on your dashboard.
      </p>
      {remaining.map(net => (
        <div key={net.id} className="flex items-center justify-between rounded-lg border border-border p-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Users className="size-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">{net.name}</p>
              <p className="text-sm text-muted-foreground truncate">{net.description}</p>
            </div>
          </div>
          <Button size="sm" disabled={savingId !== null} onClick={() => handleAdd(net.id)}>
            {savingId === net.id ? "Adding..." : "Add"}
          </Button>
        </div>
      ))}
    </div>
  )
}
