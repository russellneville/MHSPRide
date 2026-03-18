import { UserAvatar } from "@/components/ui/user-avatar"
import { Car, Package, Users } from "lucide-react"

export default function DriverDetailsPopup({ driver }) {
  if (!driver) return null

  const vehicle = [driver.vehicle_year, driver.vehicle_color, driver.vehicle_make, driver.vehicle_model]
    .filter(Boolean)
    .join(' ')

  const storage = Array.isArray(driver.equipment_storage) ? driver.equipment_storage : []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <UserAvatar user={driver} size="lg" />
        <div>
          <p className="font-semibold text-base">{driver.fullname}</p>
          {driver.phone && <p className="text-sm text-muted-foreground">{driver.phone}</p>}
        </div>
      </div>

      <div className="space-y-3 text-sm">
        {vehicle && (
          <div className="flex items-start gap-2">
            <Car className="size-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-medium">Vehicle</p>
              <p className="text-muted-foreground">{vehicle}</p>
              {driver.vehicle_plate && (
                <p className="text-muted-foreground">Plate: {driver.vehicle_plate}</p>
              )}
            </div>
          </div>
        )}

        {driver.vehicle_seats && (
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground shrink-0" />
            <span className="font-medium">Passenger seats:</span>
            <span className="text-muted-foreground">{driver.vehicle_seats}</span>
          </div>
        )}

        {storage.length > 0 && (
          <div className="flex items-start gap-2">
            <Package className="size-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-medium">Equipment storage</p>
              <ul className="text-muted-foreground mt-1 space-y-0.5">
                {storage.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {!vehicle && !driver.vehicle_seats && storage.length === 0 && (
          <p className="text-muted-foreground">No vehicle details on file.</p>
        )}
      </div>
    </div>
  )
}
