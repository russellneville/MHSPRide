import { useState } from "react"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { usePopup } from "@/context/PopupContext"
import { auth } from "@/lib/firebaseClient"
import { toast } from "sonner"

const CLASSIFICATION_OPTIONS = [
  "Hill Patroller",
  "Nordic Patroller",
  "Mountain Host",
  "Apprentice Patroller",
  "Associate Patroller",
]

const STATUS_OPTIONS = ["Active", "Past Member"]

export default function AddRosterRecordPopup({ onSaved }) {
  const { closePopup } = usePopup()
  const [loading, setLoading] = useState(false)
  const [validationError, setValidationErrors] = useState({})
  const [record, setRecord] = useState({
    mhspNumber: "",
    lastName: "",
    firstName: "",
    email: "",
    address: "",
    classification: "",
    status: "",
  })

  const handleChange = (e) => {
    setRecord(prev => ({ ...prev, [e.target.id]: e.target.value }))
  }

  const validateForm = () => {
    const newErrors = {}
    if (!record.mhspNumber.trim()) newErrors.mhspNumber = "MHSP # is required"
    if (!record.lastName.trim()) newErrors.lastName = "Last name is required"
    if (!record.email.trim()) newErrors.email = "Troopiter email is required"
    setValidationErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return
    setLoading(true)
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch("/api/admin/roster/add", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(record),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not add roster record")
      toast.success(`Added ${record.firstName} ${record.lastName}`.trim())
      onSaved?.()
      closePopup()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="mhspNumber">MHSP #</Label>
          <Input id="mhspNumber" value={record.mhspNumber} onChange={handleChange} />
          {validationError.mhspNumber && <p className="text-red-500 text-sm">{validationError.mhspNumber}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" value={record.lastName} onChange={handleChange} />
          {validationError.lastName && <p className="text-red-500 text-sm">{validationError.lastName}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="firstName">First name</Label>
        <Input id="firstName" value={record.firstName} onChange={handleChange} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Troopiter email</Label>
        <Input id="email" type="email" value={record.email} onChange={handleChange} />
        {validationError.email && <p className="text-red-500 text-sm">{validationError.email}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" value={record.address} onChange={handleChange} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Classification</Label>
          <Select
            value={record.classification}
            onValueChange={v => setRecord(prev => ({ ...prev, classification: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {CLASSIFICATION_OPTIONS.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={record.status}
            onValueChange={v => setRecord(prev => ({ ...prev, status: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-2">
        <Button onClick={closePopup} variant="outline">Cancel</Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? "Adding..." : "Add record"}
        </Button>
      </div>
    </div>
  )
}
