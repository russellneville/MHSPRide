'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import PrivacyPolicyContent from '@/components/legal/PrivacyPolicyContent'

export default function PrivacyPage() {
  const { user } = useAuth()

  return (
    <main className="contact-page">
      <header className="contact-header">
        <Link href="/" className="landing-brand">
          <Image
            src="/assets/mhsp_title_logo_sm.png"
            alt="MHSP Ride logo"
            width={120}
            height={35}
            className="landing-brand-mark"
          />
          <span>Mount Hood Ski Patrol Carpooling</span>
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
        <div className="contact-card policy-card">
          <PrivacyPolicyContent />
        </div>
      </div>
    </main>
  )
}
