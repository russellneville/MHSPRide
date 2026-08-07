'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithCustomToken } from 'firebase/auth'
import { auth } from '@/lib/firebaseClient'

// Receives a Troopiter launch token in the URL fragment (never sent to the
// server in access logs, per integration-proposal.md's "Sequence" step 5),
// exchanges it for a Firebase custom token via /api/launch, and signs the
// user straight into their existing MHSP Ride session.
export default function LaunchPage() {
  const router = useRouter()
  const [status, setStatus] = useState('verifying')
  const [error, setError] = useState('')
  const [prefill, setPrefill] = useState(null)

  useEffect(() => {
    const hash = window.location.hash
    const token = new URLSearchParams(hash.replace(/^#/, '')).get('token')

    if (!token) {
      setStatus('error')
      setError('No launch token found in this link.')
      return
    }

    // Clear the token out of the visible URL immediately — it's single-use
    // and there's no reason to leave it sitting in browser history.
    window.history.replaceState(null, '', '/launch')

    async function run() {
      try {
        const res = await fetch('/api/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()

        if (!res.ok || !data.ok) {
          setStatus('error')
          setError(data.error || 'This launch link is no longer valid.')
          return
        }

        if (data.needsRegistration) {
          setStatus('needsRegistration')
          setPrefill(data.prefill)
          return
        }

        await signInWithCustomToken(auth, data.customToken)
        router.replace('/dashboard')
      } catch (err) {
        setStatus('error')
        setError('Something went wrong signing you in.')
      }
    }

    run()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-3">
        {status === 'verifying' && (
          <p className="text-muted-foreground">Signing you in...</p>
        )}
        {status === 'needsRegistration' && (
          <>
            <p>No MHSP Ride account found for {prefill?.email}.</p>
            <a href="/register" className="text-primary underline">
              Create an account
            </a>
          </>
        )}
        {status === 'error' && (
          <p className="text-destructive">{error}</p>
        )}
      </div>
    </div>
  )
}
