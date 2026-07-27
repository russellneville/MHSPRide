'use client'
import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { findActiveMessage } from '@/lib/systemMessages'
import { Info, AlertTriangle, AlertOctagon } from 'lucide-react'

const SEVERITY_STYLES = {
  info: 'bg-blue-50 border-blue-400 text-blue-900 dark:bg-blue-950 dark:border-blue-600 dark:text-blue-100',
  warning: 'bg-amber-50 border-amber-400 text-amber-900 dark:bg-amber-950 dark:border-amber-600 dark:text-amber-100',
  urgent: 'bg-red-50 border-red-400 text-red-900 dark:bg-red-950 dark:border-red-600 dark:text-red-100',
}

const SEVERITY_ICONS = {
  info: Info,
  warning: AlertTriangle,
  urgent: AlertOctagon,
}

// Re-checked on an interval (not just on Firestore snapshot changes) since a
// message can flip from upcoming/active/expired purely because the clock
// moved, with no document write to trigger a re-render otherwise.
const RECHECK_INTERVAL_MS = 30_000

export default function SystemMessageBanner({ loginOnly = false }) {
  const [messages, setMessages] = useState([])
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'system_messages'),
      snap => {
        setMessages(snap.docs.map(d => {
          const data = d.data()
          return {
            id: d.id,
            message: data.message,
            severity: data.severity,
            show_on_login: data.show_on_login,
            start_at: data.start_at.toDate(),
            end_at: data.end_at.toDate(),
          }
        }))
      },
      err => console.error('[SystemMessageBanner]', err)
    )
    return unsubscribe
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), RECHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const active = findActiveMessage(messages, { now, loginOnly })
  if (!active) return null

  const Icon = SEVERITY_ICONS[active.severity] || Info
  const style = SEVERITY_STYLES[active.severity] || SEVERITY_STYLES.info

  return (
    <div className={`w-full border-b px-4 py-1.5 flex items-center justify-center gap-2 text-center text-[12px] leading-tight ${style}`}>
      <Icon className="size-3.5 shrink-0" />
      <span>{active.message}</span>
    </div>
  )
}
