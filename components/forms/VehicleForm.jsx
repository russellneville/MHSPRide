import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COLORS, STORAGE_OPTIONS, VEHICLE_NAME_MAX_LENGTH, VEHICLE_PLATE_MAX_LENGTH, sanitizeVehicleName, vehicleYearOptions } from "@/lib/vehicles";

export default function VehicleForm({ vehicle, onChange }) {
  const set = (field, value) => onChange({ ...vehicle, [field]: value })

  const handleInput = (e) => {
    const { id, value } = e.target
    if (id === "make" || id === "model") {
      set(id, sanitizeVehicleName(value))
    } else {
      set(id, id === "seats" ? (value === "" ? "" : Number(value)) : value)
    }
  }

  const toggleStorage = (value) => {
    const current = vehicle.storage || []
    set("storage", current.includes(value) ? current.filter(v => v !== value) : [...current, value])
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="make">Make</Label>
          <Input id="make" placeholder="e.g. Toyota" maxLength={VEHICLE_NAME_MAX_LENGTH} value={vehicle.make || ""} onChange={handleInput} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="model">Model</Label>
          <Input id="model" placeholder="e.g. 4Runner" maxLength={VEHICLE_NAME_MAX_LENGTH} value={vehicle.model || ""} onChange={handleInput} />
        </div>
        <div className="space-y-1">
          <Label>Year</Label>
          <Select value={vehicle.year || ""} onValueChange={(v) => set("year", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {vehicleYearOptions().map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Color</Label>
          <Select value={vehicle.color || ""} onValueChange={(v) => set("color", v)}>
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
          <Label htmlFor="seats">Passenger Seats</Label>
          <Input id="seats" type="number" min={1} placeholder="e.g. 4" value={vehicle.seats || ""} onChange={handleInput} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="plate">License Plate</Label>
          <Input id="plate" placeholder="e.g. ABC-1234" maxLength={VEHICLE_PLATE_MAX_LENGTH} value={vehicle.plate || ""} onChange={handleInput} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Equipment Storage</Label>
        <div className="grid grid-cols-2 gap-2">
          {STORAGE_OPTIONS.map(opt => {
            const checked = (vehicle.storage || []).includes(opt.value)
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
                  onChange={() => toggleStorage(opt.value)}
                />
                {opt.label}
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
