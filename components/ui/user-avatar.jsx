'use client'

import { useEffect, useState } from 'react'
import { resolveLivePhotoUrl } from '@/lib/profilePhoto'

const SIZES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
}

const PALETTE = [
  '#1e3a5f',
  '#2B72B8',
  '#1a6b3c',
  '#8b2020',
  '#4a5568',
  '#6b4c11',
]

function getInitials(fullname) {
  if (!fullname) return '?'
  const words = fullname.trim().split(/\s+/)
  if (words.length === 1) return words[0][0].toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function getColor(fullname) {
  if (!fullname) return PALETTE[0]
  let sum = 0
  for (let i = 0; i < fullname.length; i++) {
    sum += fullname.charCodeAt(i)
  }
  return PALETTE[sum % 6]
}

export function UserAvatar({ user, size = 'md', className = '' }) {
  const [src, setSrc] = useState(user?.photoURL || null)
  const [triedLive, setTriedLive] = useState(false)
  const sizeClasses = SIZES[size] ?? SIZES.md
  const base = `inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 ${sizeClasses} ${className}`

  // Snapshotted photoURLs (driver/passenger info copied onto ride/booking docs)
  // go stale whenever the owner re-uploads a photo. On load failure, try the
  // live photo once before giving up to initials.
  const handleError = () => {
    const uid = user?.id || user?.uid
    if (!triedLive && uid) {
      setTriedLive(true)
      resolveLivePhotoUrl(uid).then(setSrc)
    } else {
      setSrc(null)
    }
  }

  // Some snapshots (e.g. older ride_requests docs from before this field was
  // captured) never had a photoURL at all, so there's no <img> to fail and
  // trigger handleError above — fall through to the same live lookup here
  // instead of going straight to initials.
  useEffect(() => {
    const uid = user?.id || user?.uid
    if (!user?.photoURL && !triedLive && uid) {
      setTriedLive(true)
      resolveLivePhotoUrl(uid).then(setSrc)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.uid, user?.photoURL])

  if (src) {
    return (
      <div className={base}>
        <img
          src={src}
          alt={user?.fullname ?? 'User photo'}
          className="w-full h-full object-cover"
          onError={handleError}
        />
      </div>
    )
  }

  const initials = getInitials(user?.fullname)
  const bg = getColor(user?.fullname)

  return (
    <div
      className={`${base} font-semibold text-white`}
      style={{ backgroundColor: bg }}
      aria-label={user?.fullname ?? 'User avatar'}
    >
      {initials}
    </div>
  )
}

export default UserAvatar
