import { useState } from "react"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { usePopup } from "@/context/PopupContext"
import { auth, db } from "@/lib/firebaseClient"
import { doc, getDoc } from "firebase/firestore"
import { logEvent } from "@/lib/activityLog"
import { findOverlapping } from "@/lib/systemMessages"
import { toast } from "sonner"

const MAX_MESSAGE_LENGTH = 300

// datetime-local inputs want "YYYY-MM-DDTHH:mm" in local time, with no timezone suffix.
function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function AddSystemMessagePopup({ existingMessages = [], onSaved }) {
  const { closePopup } = usePopup()
  const [message, setMessage] = useState("")
  const [severity, setSeverity] = useState("info")
  const [startAt, setStartAt] = useState(toDatetimeLocalValue(new Date()))
  const [endAt, setEndAt] = useState("")
  const [showOnLogin, setShowOnLogin] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const startDate = startAt ? new Date(startAt) : null
  const endDate = endAt ? new Date(endAt) : null
  const validRange = startDate && endDate && !isNaN(startDate) && !isNaN(endDate) && endDate > startDate
  const canSubmit = message.trim() && message.trim().length <= MAX_MESSAGE_LENGTH && validRange && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError("")

    const conflict = findOverlapping(existingMessages, startDate, endDate)
    if (conflict) {
      setError(`Overlaps with a message scheduled ${conflict.start_at.toLocaleString()} – ${conflict.end_at.toLocaleString()}`)
      setSubmitting(false)
      return
    }

    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch("/api/admin/system-messages/add", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: message.trim(),
          severity,
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          show_on_login: showOnLogin,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not add message")

      const actorDoc = await getDoc(doc(db, 'users', auth.currentUser.uid)).catch(() => null)
      const actorData = actorDoc?.data() || {}
      logEvent({
        type: "admin.system_message_created",
        message: `System message created: "${message.trim()}"`,
        userId: auth.currentUser?.uid,
        userName: actorData.fullname,
        mhspNumber: actorData.mhspNumber,
        metadata: { messageId: data.id, severity, start_at: startDate.toISOString(), end_at: endDate.toISOString(), show_on_login: showOnLogin },
      }).catch(() => {})

      toast.success("System message scheduled")
      onSaved?.()
      closePopup()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="system-message-text">Message</Label>
        <Textarea
          id="system-message-text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="e.g. Scheduled maintenance Saturday 10pm–2am — bookings may be briefly unavailable."
        />
        <p className="text-xs text-muted-foreground text-right">{message.length}/{MAX_MESSAGE_LENGTH}</p>
      </div>

      <div className="space-y-2">
        <Label>Severity</Label>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="system-message-start">Starts</Label>
          <Input id="system-message-start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="system-message-end">Ends</Label>
          <Input id="system-message-end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </div>
      </div>
      {startDate && endDate && !isNaN(startDate) && !isNaN(endDate) && endDate <= startDate && (
        <p className="text-red-500 text-sm">End date must be after the start date</p>
      )}

      <div className="flex items-center gap-2">
        <Checkbox id="system-message-login" checked={showOnLogin} onCheckedChange={setShowOnLogin} />
        <Label htmlFor="system-message-login" className="font-normal">Also show on login page</Label>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex justify-end gap-4 pt-2">
        <Button onClick={closePopup} variant="outline">Cancel</Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? "Scheduling…" : "Schedule message"}
        </Button>
      </div>
    </div>
  )
}
