import { useState } from "react"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { usePopup } from "@/context/PopupContext"

// Local input state while the dialog is open — the popup's content is a
// snapshotted element in PopupContext, so binding directly to a parent-owned
// value prop would freeze the input at whatever it was when the dialog opened.
// onApply is only called on Search/Enter/Clear, not on every keystroke.
export default function SearchRidesPopup({ initialValue, onApply }) {
  const { closePopup } = usePopup()
  const [value, setValue] = useState(initialValue || "")

  const handleApply = () => {
    onApply(value.trim())
    closePopup()
  }

  const handleClear = () => {
    onApply("")
    closePopup()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ride-search">Search by driver, origin, or destination</Label>
        <Input
          id="ride-search"
          autoFocus
          placeholder="e.g. Jordan, Sandy Fred Meyer, Timberline"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
        />
      </div>
      <div className="flex justify-end gap-2">
        {initialValue && (
          <Button variant="outline" onClick={handleClear}>Clear</Button>
        )}
        <Button onClick={handleApply}>Search</Button>
      </div>
    </div>
  )
}
