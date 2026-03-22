'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/context/AuthContext'

export default function ContactPage() {
  const { user } = useAuth()
  const returnHref = user ? '/dashboard' : '/'
  const returnLabel = user ? 'Back to Dashboard' : 'Back to home'
  const [form, setForm] = useState({ name: '', email: '', type: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.type || !form.message) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Submission failed')
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="contact-page">
      <header className="contact-header">
        <Link href="/" className="landing-brand">
          <Image src="/assets/MHSP-Logo.png" alt="MHSPRide logo" width={44} height={44} />
          <div>
            <p>MHSPRide</p>
            <span>Mount Hood Ski Patrol Carpooling</span>
          </div>
        </Link>
        <nav className="landing-nav">
          <a href="/#home">Home</a>
          <a href="/#how-it-works">How It Works</a>
          {user ? (
            <Link href="/dashboard">Dashboard</Link>
          ) : (
            <Link href="/login">Log In</Link>
          )}
        </nav>
      </header>

      <div className="contact-body">
        <div className="contact-card">
          <h1>Contact Us</h1>
          <p className="contact-sub">Questions, feedback, or something not working? We want to hear from you.</p>

          {submitted ? (
            <div className="contact-success">
              <p>Message sent. We'll follow up if needed.</p>
              <Link href={returnHref}>{returnLabel}</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="contact-form">
              <div className="contact-row">
                <div className="contact-field">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                    required
                  />
                </div>
                <div className="contact-field">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div className="contact-field">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={val => setForm(f => ({ ...f, type: val }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                    <SelectItem value="bug">Bug Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="contact-field">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Tell us what's on your mind…"
                  className="resize-none h-32"
                  required
                />
              </div>

              {error && <p className="contact-error">{error}</p>}

              <Button type="submit" disabled={submitting || !form.name || !form.email || !form.type || !form.message}>
                {submitting ? 'Sending…' : 'Send Message'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
