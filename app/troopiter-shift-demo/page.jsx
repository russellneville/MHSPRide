'use client'

import { useEffect, useMemo, useState } from 'react'

// A mockup of a Troopiter shift page (issue #199) — simulates the "Get a
// Ride" carpool icon that would sit next to Troopiter's own carpool map on
// a real shift page. Deliberately unauthenticated and styled nothing like
// MHSP Ride or the Troopiter skin: this represents a site MHSP Ride users
// haven't logged into. Only linked from the MHSP Ride admin nav (super-admin
// only) — the page itself has no access check, same as the real thing
// wouldn't be behind an MHSP Ride login.
export default function TroopiterShiftDemoPage() {
  const [roster, setRoster] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewingAsEmail, setViewingAsEmail] = useState('')
  const [companionEmails, setCompanionEmails] = useState(new Set())
  const [shiftDate, setShiftDate] = useState('')
  const [shiftTime, setShiftTime] = useState('08:00')
  const [shiftLocation, setShiftLocation] = useState('Armadillo')
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    setShiftDate(tomorrow.toISOString().slice(0, 10))

    fetch('/api/troopiter-demo/roster')
      .then(res => res.json())
      .then(data => {
        setRoster(data.roster || [])
        if (data.roster?.length) setViewingAsEmail(data.roster[0].email)
      })
      .catch(() => setError('Could not load the roster.'))
      .finally(() => setLoading(false))
  }, [])

  const viewingAs = useMemo(() => roster.find(m => m.email === viewingAsEmail), [roster, viewingAsEmail])
  const others = useMemo(() => roster.filter(m => m.email !== viewingAsEmail), [roster, viewingAsEmail])

  function toggleCompanion(email) {
    setCompanionEmails(prev => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  async function handleGetRide() {
    if (!viewingAs) return
    setLaunching(true)
    setError('')
    try {
      const res = await fetch('/api/troopiter-demo/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: viewingAs.email,
          name: `${viewingAs.firstName} ${viewingAs.lastName}`.trim(),
          shiftDate,
          shiftTime,
          shiftLocation,
          roster: others
            .filter(m => companionEmails.has(m.email))
            .map(m => ({ name: `${m.firstName} ${m.lastName}`.trim(), email: m.email })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not start the launch.')
      window.location.href = `/launch#token=${data.token}`
    } catch (err) {
      setError(err.message)
      setLaunching(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="mb-6 text-center">
          <span className="inline-block text-xs font-semibold tracking-wide uppercase bg-slate-900 text-white px-2 py-1 rounded">
            Troopiter (simulated)
          </span>
          <p className="text-xs text-slate-500 mt-2">
            Not a real Troopiter page — a mockup for rehearsing the carpool launch handoff (issue #199).
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-6">
          <div>
            <h1 className="text-lg font-semibold">Armadillo Mountain Ski Patrol</h1>
            <p className="text-sm text-slate-500">Shift Schedule</p>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading roster…</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Date</label>
                  <input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Time</label>
                  <input type="time" value={shiftTime} onChange={e => setShiftTime(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Location</label>
                  <input type="text" value={shiftLocation} onChange={e => setShiftLocation(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Signed in as</label>
                <select
                  value={viewingAsEmail}
                  onChange={e => { setViewingAsEmail(e.target.value); setCompanionEmails(new Set()) }}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                >
                  {roster.map(m => (
                    <option key={m.email} value={m.email}>{m.firstName} {m.lastName} — {m.email}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600">
                  Also signed up for this shift ({companionEmails.size} selected)
                </label>
                <div className="border border-slate-200 rounded max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {others.map(m => (
                    <label key={m.email} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={companionEmails.has(m.email)}
                        onChange={() => toggleCompanion(m.email)}
                      />
                      <span>{m.firstName} {m.lastName}</span>
                      <span className="text-slate-400 text-xs">{m.email}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-sm text-slate-600">Carpool for this shift</span>
                <button
                  onClick={handleGetRide}
                  disabled={!viewingAs || launching}
                  className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded"
                >
                  🚗 {launching ? 'Launching…' : 'Get a Ride'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
