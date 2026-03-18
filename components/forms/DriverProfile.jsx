import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "@radix-ui/react-label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

const COLORS = ["Black","White","Silver","Gray","Red","Blue","Green","Brown","Beige","Orange","Yellow","Gold","Purple","Other"]

const STORAGE_OPTIONS = [
  { value: "ski_box",     label: "Ski/board roof box" },
  { value: "roof_rack",   label: "Roof rack" },
  { value: "trunk",       label: "Trunk" },
  { value: "back_seats",  label: "Back seats" },
  { value: "truck_bed",   label: "Truck bed" },
  { value: "cargo_area",  label: "Cargo area (SUV/van)" },
]

export default function DriverProfile({ profile, setProfile }) {
  const handle = (e) => {
    setProfile(prev => ({ ...prev, [e.target.id]: e.target.value }))
  }

  const handleSelect = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }))
  }

  const handleStorageToggle = (value) => {
    const current = profile.vehicle_storage || []
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    setProfile(prev => ({ ...prev, vehicle_storage: updated }))
  }

  return (
    <Card>
      <CardHeader className="!pb-3 border-b border-border">
        <CardTitle>Vehicle Information</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="vehicle_make">Make</Label>
            <Input
              id="vehicle_make"
              placeholder="e.g. Toyota"
              value={profile.vehicle_make || ""}
              onChange={handle}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vehicle_model">Model</Label>
            <Input
              id="vehicle_model"
              placeholder="e.g. 4Runner"
              value={profile.vehicle_model || ""}
              onChange={handle}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vehicle_year">Year</Label>
            <Input
              id="vehicle_year"
              placeholder="e.g. 2021"
              value={profile.vehicle_year || ""}
              onChange={handle}
            />
          </div>
          <div className="space-y-1">
            <Label>Color</Label>
            <Select
              value={profile.vehicle_color || ""}
              onValueChange={(v) => handleSelect("vehicle_color", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select color" />
              </SelectTrigger>
              <SelectContent>
                {COLORS.map(c => (
                  <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="vehicle_seats">Passenger Seats</Label>
            <Input
              id="vehicle_seats"
              type="number"
              min={1}
              placeholder="e.g. 4"
              value={profile.vehicle_seats || ""}
              onChange={handle}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vehicle_plate">License Plate</Label>
            <Input
              id="vehicle_plate"
              placeholder="e.g. ABC-1234"
              value={profile.vehicle_plate || ""}
              onChange={handle}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Equipment Storage</Label>
          <div className="grid grid-cols-2 gap-2">
            {STORAGE_OPTIONS.map(opt => {
              const checked = (profile.vehicle_storage || []).includes(opt.value)
              return (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                    checked
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={checked}
                    onChange={() => handleStorageToggle(opt.value)}
                  />
                  {opt.label}
                </label>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
