import { useEffect, useState } from "react"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { LOCATION_NAME_MAX_LENGTH } from "@/lib/utils"
import { useAddressValidation } from "@/hooks/use-address-validation"
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react"

// Shared by OfferRidePopup, RequestRidePopup, EditRidePopup, and
// EditRideRequestPopup — known-location-or-free-text picker. Free text
// triggers address validation on blur (see hooks/use-address-validation);
// predefined-location selections skip it entirely (already trusted).
//
// onValidated({ latitude, longitude, formattedAddress } | null) fires
// whenever this field's current value becomes submit-safe (auto-confirmed,
// or confirmed via explicit click) or leaves that state (edited, or a
// predefined location is selected — the parent already has that location's
// lat/lon from the locations list in that case).
export function LocationPicker({ value, onSelectChange, otherValue, onOtherChange, locations, selectPlaceholder, onValidated }) {
  const { status, result, error, validate, reset } = useAddressValidation()
  // The hook's status only reflects "what did Google say" — it stays
  // 'needs-confirmation' even after the user clicks "Use this address"
  // (there's nothing to re-validate). This tracks "did the user agree to
  // it," so the UI can actually show that the click did something instead
  // of leaving the same "Did you mean…" box on screen forever.
  const [accepted, setAccepted] = useState(false)

  const handleOtherChange = (newValue) => {
    onOtherChange(newValue)
    if (newValue) onSelectChange('')
    // Any edit after a previous validation completed invalidates it — the
    // hook's own state no longer matches what's currently in the field.
    if (status !== 'idle') {
      reset()
      setAccepted(false)
      onValidated?.(null)
    }
  }

  const handleBlur = () => {
    if (!otherValue.trim()) return
    if (status === 'confirmed' || status === 'needs-confirmation') return
    validate(otherValue.trim())
  }

  const handleAcceptSuggestion = () => {
    if (!result) return
    setAccepted(true)
    onValidated?.({ latitude: result.latitude, longitude: result.longitude, formattedAddress: result.formattedAddress })
  }

  // Auto-confirmed exact matches report up as soon as the hook settles —
  // nothing for the user to review, so no click is required (see
  // resources/address-validation-implementation.md). Must run as an effect,
  // not during render, since it calls the parent's state setter.
  useEffect(() => {
    if (status === 'confirmed' && result) {
      onValidated?.({ latitude: result.latitude, longitude: result.longitude, formattedAddress: result.formattedAddress })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, result])

  return (
    <div className="space-y-2">
      <Select
        value={otherValue ? '' : value}
        onValueChange={(v) => {
          // onSelectChange is expected to set this field's coords itself
          // (predefined locations are already trusted — see
          // LocationsContext.getLocationCoords — so there's nothing for
          // this hook to validate). Only clear the free-text validation
          // display state here; don't call onValidated(null), which would
          // clobber the coords onSelectChange just set.
          onSelectChange(v)
          onOtherChange('')
          reset()
          setAccepted(false)
        }}
        disabled={!!otherValue}
      >
        <SelectTrigger>
          <SelectValue placeholder={selectPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {locations.map(loc => (
            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="Other — type a location"
        value={otherValue}
        maxLength={LOCATION_NAME_MAX_LENGTH}
        onChange={(e) => handleOtherChange(e.target.value)}
        onBlur={handleBlur}
      />
      {status === 'checking' && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="size-3 animate-spin" /> Checking address…
        </p>
      )}
      {(status === 'confirmed' || (status === 'needs-confirmation' && accepted)) && result && (
        <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
          <CheckCircle2 className="size-3" /> Address confirmed{result.formattedAddress ? `: ${result.formattedAddress}` : ''}
        </p>
      )}
      {status === 'needs-confirmation' && result && !accepted && (
        <div className="text-xs rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-2 py-1.5 space-y-1">
          <p className="text-amber-800 dark:text-amber-400">
            Did you mean: <strong>{result.formattedAddress}</strong>?
          </p>
          <button
            type="button"
            className="text-primary underline underline-offset-2 hover:text-primary/70 transition-colors"
            onClick={handleAcceptSuggestion}
          >
            Use this address
          </button>
        </div>
      )}
      {(status === 'invalid' || status === 'error') && (
        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <TriangleAlert className="size-3" />
          {status === 'invalid' ? "We couldn't confirm that address — check it and try again." : (error || 'Could not validate that address.')}
        </p>
      )}
    </div>
  )
}
