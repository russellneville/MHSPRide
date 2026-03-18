'use client'
import { useState } from "react"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db, auth } from "@/lib/firebaseClient"
import { MessageSquare, X, ChevronUp } from "lucide-react"
import { Button } from "./button"
import { Textarea } from "./textarea"
import { toast } from "sonner"

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState("feedback")
  const [text, setText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!text.trim()) return
    setSubmitting(true)
    try {
      await addDoc(collection(db, "feedback"), {
        type,
        message: text.trim(),
        userId: auth.currentUser?.uid || null,
        submittedAt: serverTimestamp(),
      })
      toast.success("Thanks for your feedback!")
      setText("")
      setType("feedback")
      setOpen(false)
    } catch {
      toast.error("Failed to submit feedback. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="w-72 rounded-xl border border-border bg-card shadow-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Share feedback</p>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="size-4" />
            </button>
          </div>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="feedback-type"
                value="feedback"
                checked={type === "feedback"}
                onChange={() => setType("feedback")}
                className="accent-primary"
              />
              Feedback
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="feedback-type"
                value="bug"
                checked={type === "bug"}
                onChange={() => setType("bug")}
                className="accent-primary"
              />
              Bug
            </label>
          </div>

          <Textarea
            placeholder={type === "bug" ? "Describe what happened…" : "What's on your mind?"}
            value={text}
            onChange={e => setText(e.target.value)}
            className="resize-none h-24 text-sm"
          />

          <Button className="w-full" onClick={handleSubmit} disabled={!text.trim() || submitting}>
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow-md hover:bg-primary/90 transition-colors"
      >
        {open ? <ChevronUp className="size-4" /> : <MessageSquare className="size-4" />}
        Feedback
      </button>
    </div>
  )
}
