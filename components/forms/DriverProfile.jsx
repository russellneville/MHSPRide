import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Trash2 } from "lucide-react";
import VehicleForm from "./VehicleForm";
import { createVehicleId, EMPTY_VEHICLE } from "@/lib/vehicles";

export default function DriverProfile({ profile, setProfile, className }) {
  const vehicles = profile.vehicles || []

  const updateVehicle = (id, updated) => {
    setProfile(prev => ({
      ...prev,
      vehicles: (prev.vehicles || []).map(v => v.id === id ? updated : v),
    }))
  }

  const addVehicle = () => {
    setProfile(prev => {
      const existing = prev.vehicles || []
      return {
        ...prev,
        vehicles: [...existing, { ...EMPTY_VEHICLE, id: createVehicleId(), isDefault: existing.length === 0 }],
      }
    })
  }

  const removeVehicle = (id) => {
    setProfile(prev => {
      const existing = prev.vehicles || []
      const removedWasDefault = existing.find(v => v.id === id)?.isDefault
      const remaining = existing.filter(v => v.id !== id)
      if (removedWasDefault && remaining.length > 0) {
        remaining[0] = { ...remaining[0], isDefault: true }
      }
      return { ...prev, vehicles: remaining }
    })
  }

  const setDefaultVehicle = (id) => {
    setProfile(prev => ({
      ...prev,
      vehicles: (prev.vehicles || []).map(v => ({ ...v, isDefault: v.id === id })),
    }))
  }

  return (
    <Card className={className}>
      <CardHeader className="!pb-3 border-b border-border">
        <CardTitle>Vehicles</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {vehicles.length === 0 && (
          <p className="text-sm text-muted-foreground">No vehicles added yet.</p>
        )}

        {vehicles.map((vehicle, i) => (
          <div key={vehicle.id} className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Vehicle {i + 1}</span>
              <div className="flex items-center gap-4">
                {vehicles.length > 1 && (
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <input
                      type="radio"
                      name="default_vehicle"
                      checked={!!vehicle.isDefault}
                      onChange={() => setDefaultVehicle(vehicle.id)}
                    />
                    Default
                  </label>
                )}
                {vehicles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVehicle(vehicle.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove vehicle"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
            <VehicleForm vehicle={vehicle} onChange={(updated) => updateVehicle(vehicle.id, updated)} />
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={addVehicle}>
          <Plus className="size-4" /> Add another vehicle
        </Button>
      </CardContent>
    </Card>
  )
}
