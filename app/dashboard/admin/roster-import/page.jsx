'use client'
import { useRef, useState } from 'react'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import AdminGuard from '@/components/AdminGuard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { toast } from 'sonner'
import { auth } from '@/lib/firebaseClient'
import { ChevronDown, ChevronRight, UploadCloud, CheckCircle2, AlertTriangle } from 'lucide-react'

// --- helpers ---
async function adminFetch(url, options = {}) {
  const token = await auth.currentUser?.getIdToken()
  return fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  })
}

function SectionToggle({ title, badge, badgeVariant = 'secondary', children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-2 py-2 text-sm font-medium hover:underline">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {title}
          {badge != null && (
            <Badge variant={badgeVariant} className="ml-1">{badge}</Badge>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}

// --- Step 1: Upload ---
function UploadStep({ onPreview }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handlePreview() {
    if (!file) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('csv', file)
      const res = await adminFetch('/api/admin/roster-import', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed')
      onPreview(data.sessionId, data.preview)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-base">Upload Roster CSV</CardTitle>
        <CardDescription>
          Upload the raw Troopiter roster export. No pre-processing needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 cursor-pointer hover:border-muted-foreground/60 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {file ? file.name : 'Click to select a .csv file'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button onClick={handlePreview} disabled={!file || loading} className="w-full">
          {loading ? 'Analyzing…' : 'Preview Changes'}
        </Button>
      </CardContent>
    </Card>
  )
}

// --- Step 2: Review ---
function ReviewStep({ preview, onConfirm, onCancel, loading }) {
  const { renames, newMembers, updated, deactivated, ambiguous } = preview

  const claimedDeactivated = deactivated.filter(d => d.hasClaim).length
  const claimedRenames     = renames.filter(r => r.hasClaim).length
  const hasAmbiguous       = ambiguous.length > 0

  const summaryParts = [
    newMembers.length  && `${newMembers.length} new`,
    renames.length     && `${renames.length} ID change${renames.length !== 1 ? 's' : ''}`,
    updated.length     && `${updated.length} field update${updated.length !== 1 ? 's' : ''}`,
    deactivated.length && `${deactivated.length} deactivated${claimedDeactivated ? ` (${claimedDeactivated} with active accounts)` : ''}`,
  ].filter(Boolean)

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Summary */}
      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        {summaryParts.length ? summaryParts.join(' · ') : 'No changes detected.'}
      </div>

      {/* Ambiguous warning — blocks commit */}
      {hasAmbiguous && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Manual review required — commit blocked</p>
            <p className="mt-1">
              {ambiguous.length} member{ambiguous.length !== 1 ? 's have' : ' has'} multiple name
              matches. Resolve these in Troopiter before re-uploading.
            </p>
            <ul className="mt-2 list-disc pl-4">
              {ambiguous.map(a => (
                <li key={a.oldId}>
                  <span className="font-mono">#{a.oldId}</span> {a.name} →{' '}
                  {a.candidates.map(c => `#${c.id}`).join(', ')}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ID Changes */}
      {renames.length > 0 && (
        <SectionToggle
          title="ID Changes"
          badge={renames.length}
          badgeVariant="default"
          defaultOpen={true}
        >
          <Table className="mt-2 text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Old #</TableHead>
                <TableHead>New #</TableHead>
                <TableHead>Has account?</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renames.map(r => (
                <TableRow key={r.oldId}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono">{r.oldId}</TableCell>
                  <TableCell className="font-mono">{r.newId}</TableCell>
                  <TableCell>{r.hasClaim ? '✓ migrating' : '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {[r.emailChanged && 'email', r.addressChanged && 'address'].filter(Boolean).join(', ') || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionToggle>
      )}

      {/* New Members */}
      {newMembers.length > 0 && (
        <SectionToggle title="New Members" badge={newMembers.length} defaultOpen={true}>
          <Table className="mt-2 text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>MHSP #</TableHead>
                <TableHead>Classifications</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {newMembers.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="font-mono">{m.id}</TableCell>
                  <TableCell className="text-muted-foreground">{m.classifications.join(', ') || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionToggle>
      )}

      {/* Field Updates */}
      {updated.length > 0 && (
        <SectionToggle title="Field Updates" badge={updated.length}>
          <Table className="mt-2 text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>MHSP #</TableHead>
                <TableHead>Changed fields</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {updated.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="font-mono">{u.id}</TableCell>
                  <TableCell className="text-muted-foreground">{u.changes.join(', ')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionToggle>
      )}

      {/* Deactivated */}
      {deactivated.length > 0 && (
        <SectionToggle
          title="Deactivated"
          badge={deactivated.length}
          badgeVariant={claimedDeactivated ? 'destructive' : 'secondary'}
        >
          {claimedDeactivated > 0 && (
            <p className="mt-2 text-xs text-destructive">
              {claimedDeactivated} account{claimedDeactivated !== 1 ? 's' : ''} will have login disabled.
            </p>
          )}
          <Table className="mt-2 text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>MHSP #</TableHead>
                <TableHead>Has account?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deactivated.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="font-mono">{d.id}</TableCell>
                  <TableCell className={d.hasClaim ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                    {d.hasClaim ? 'yes — login will be disabled' : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionToggle>
      )}

      {summaryParts.length === 0 && !hasAmbiguous && (
        <p className="text-sm text-muted-foreground">
          The uploaded roster matches the current database. Nothing to do.
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          onClick={onConfirm}
          disabled={loading || hasAmbiguous || summaryParts.length === 0}
        >
          {loading ? 'Importing…' : 'Confirm Import'}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
      </div>
    </div>
  )
}

// --- Step 3: Done ---
function DoneStep({ summary }) {
  const lines = [
    summary.renames      && `${summary.renames} ID change${summary.renames !== 1 ? 's' : ''}`,
    summary.newMembers   && `${summary.newMembers} new member${summary.newMembers !== 1 ? 's' : ''}`,
    summary.updated      && `${summary.updated} field update${summary.updated !== 1 ? 's' : ''}`,
    summary.deactivated  && `${summary.deactivated} deactivated`,
    summary.accountsDisabled && `${summary.accountsDisabled} account${summary.accountsDisabled !== 1 ? 's' : ''} disabled`,
    summary.geocoded     && `${summary.geocoded} address${summary.geocoded !== 1 ? 'es' : ''} geocoded`,
  ].filter(Boolean)

  return (
    <div className="flex flex-col items-start gap-4 max-w-md">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <span className="font-semibold">Import complete</span>
      </div>
      <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
        {lines.map(l => <li key={l}>{l}</li>)}
        {lines.length === 0 && <li>No changes applied.</li>}
      </ul>
      <Button variant="outline" asChild>
        <a href="/dashboard/admin/users">View Users</a>
      </Button>
    </div>
  )
}

// --- Page ---
export default function RosterImportPage() {
  const [step, setStep] = useState(1)
  const [sessionId, setSessionId] = useState(null)
  const [preview, setPreview] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [summary, setSummary] = useState(null)

  function handlePreview(sid, prev) {
    setSessionId(sid)
    setPreview(prev)
    setStep(2)
  }

  async function handleConfirm() {
    setConfirming(true)
    try {
      const res = await adminFetch(`/api/admin/roster-import/${sessionId}/commit`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Commit failed')
      setSummary(data)
      setStep(3)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setConfirming(false)
    }
  }

  function handleCancel() {
    setStep(1)
    setSessionId(null)
    setPreview(null)
  }

  const stepLabel = { 1: 'Upload', 2: 'Review', 3: 'Complete' }

  return (
    <AdminGuard>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold">Roster Import</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Step {step} of 3 — {stepLabel[step]}
            </p>
          </div>

          {step === 1 && <UploadStep onPreview={handlePreview} />}
          {step === 2 && (
            <ReviewStep
              preview={preview}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              loading={confirming}
            />
          )}
          {step === 3 && <DoneStep summary={summary} />}
        </div>
      </DashboardLayout>
    </AdminGuard>
  )
}
