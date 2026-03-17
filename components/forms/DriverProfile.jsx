import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "@radix-ui/react-label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

const COLORS = ["Black","White","Silver","Gray","Red","Blue","Green","Brown","Beige","Orange","Yellow","Gold","Purple","Other"]

export default function DriverProfile({ profile, setProfile }) {
  const handle = (e) => {
    setProfile(prev => ({ ...prev, [e.target.id]: e.target.value }))
  }

  const handleSelect = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }))
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
            <Label htmlFor="vehicle_seats">Seats (2–8)</Label>
            <Input
              id="vehicle_seats"
              type="number"
              min={2}
              max={8}
              placeholder="e.g. 5"
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
      </CardContent>
    </Card>
  )
}
