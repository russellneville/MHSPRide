import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { TEXTAREA_MAX_LENGTH } from "@/lib/utils"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Two-step cancel confirmation: always collect a reason first, then — only
// when showShortNotice is true (canceling within the cutoff window) — a
// single-button warning to call/text the driver before actually canceling.
export default function CancelReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  showShortNotice = false,
  driverPhone,
  onConfirm,
}) {
  const [step, setStep] = useState("reason")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  function handleOpenChange(next) {
    if (!next) {
      setStep("reason")
      setReason("")
      setSubmitting(false)
    }
    onOpenChange(next)
  }

  function handleContinue(e) {
    if (!reason.trim()) return
    if (showShortNotice) {
      e.preventDefault()
      setStep("shortNotice")
    }
    // else: let the AlertDialogAction close normally, onConfirm fires below
  }

  function handleConfirm() {
    setSubmitting(true)
    onConfirm(reason.trim())
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        {step === "reason" ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason for cancellation:</label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                maxLength={TEXTAREA_MAX_LENGTH}
                placeholder="Let them know why you're canceling…"
                autoFocus
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Back</AlertDialogCancel>
              <AlertDialogAction
                disabled={!reason.trim()}
                onClick={e => {
                  handleContinue(e)
                  if (!showShortNotice) handleConfirm()
                }}
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Short notice cancellation</AlertDialogTitle>
              <AlertDialogDescription>
                You are canceling this ride with short notice. Please call or text your driver
                at {driverPhone || 'the number on file'} to ensure they know you won't be riding with them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction disabled={submitting} onClick={handleConfirm}>
                {submitting ? 'Canceling…' : 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
