'use client'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function SuperAdminGuard({ children }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!isLoading && user && user.role !== 'super-admin') {
      router.replace('/dashboard')
    }
  }, [user, isLoading, router])
  if (isLoading || !user) return null
  if (user.role !== 'super-admin') return null
  return children
}
