import { useState, useCallback, useRef } from "react"
import { auth } from "@/lib/firebaseClient"

// Shared by LocationPicker across all four ride/request forms. Wraps
// /api/validate-address, which itself wraps lib/addressValidation.js's
// Google Address Validation API call. requestIdRef guards against a slow
// earlier request resolving after a newer one, which would otherwise
// clobber the field's current status with stale data.
export function useAddressValidation() {
  const [state, setState] = useState({ status: "idle", result: null, error: null })
  const requestIdRef = useRef(0)

  const validate = useCallback(async (addressText) => {
    if (!addressText?.trim()) {
      setState({ status: "idle", result: null, error: null })
      return
    }
    const requestId = ++requestIdRef.current
    setState({ status: "checking", result: null, error: null })

    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch("/api/validate-address", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ address: addressText }),
      })
      const data = await res.json().catch(() => ({}))
      if (requestId !== requestIdRef.current) return // superseded by a newer validate() call
      if (!res.ok) {
        setState({ status: "error", result: null, error: data.error || "Could not validate that address" })
        return
      }
      setState({ status: data.status, result: data, error: null })
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      setState({ status: "error", result: null, error: err.message })
    }
  }, [])

  const reset = useCallback(() => {
    requestIdRef.current++ // invalidate any in-flight request
    setState({ status: "idle", result: null, error: null })
  }, [])

  return { ...state, validate, reset }
}
