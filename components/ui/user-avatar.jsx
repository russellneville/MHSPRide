'use client'

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
  const sizeClasses = SIZES[size] ?? SIZES.md
  const base = `inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 ${sizeClasses} ${className}`

  if (user?.photoURL) {
    return (
      <div className={base}>
        <img
          src={user.photoURL}
          alt={user?.fullname ?? 'User photo'}
          className="w-full h-full object-cover"
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
