'use client'
import { AppSidebar } from "@/components/app-sidebar"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { useAuth } from "@/context/AuthContext"
import { useSkin } from "@/context/SkinContext"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import FeedbackWidget from "@/components/ui/feedback-widget"
import SystemMessageBanner from "@/components/SystemMessageBanner"
import { IdCard, RefreshCw } from "lucide-react"

// Troopiter users arrive via a launch handoff and never see MHSP Ride's own
// branding elsewhere (issue #199) — this mirrors troopiter.com's own page
// chrome (logo, org name, account/log-out on the right) instead of MHSP
// Ride's breadcrumb header, so the app doesn't feel like a foreign tool
// they were dropped into. "Log Out" deliberately leaves the app entirely —
// it's the illusion-breaking control troopiter.com itself would show, not
// an MHSP Ride sign-out (see nav-user.jsx for the same choice in the
// sidebar's own user menu).
const TROOPITER_SIGN_OUT_URL = 'https://troopiter.com/users/sign_out'

function TroopiterHeader({ user, org, headerActions }) {
  return (
    <header className="flex min-h-14 shrink-0 items-center border-b border-border bg-background px-4 gap-3">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />
      <Image src="/assets/troopiter-ride.png" alt="troopiter" width={98} height={21} className="h-5 w-auto" />
      {org?.displayName && (
        <span className="font-semibold text-sm text-blue-700 dark:text-blue-400 truncate">{org.displayName}</span>
      )}
      <button
        type="button"
        onClick={() => window.location.reload()}
        title="Refresh"
        className="text-blue-700 dark:text-blue-400 hover:opacity-70 transition-opacity"
      >
        <RefreshCw className="size-3.5" />
      </button>
      <div className="ml-auto flex items-center gap-4">
        {headerActions}
        <span className="flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-400">
          <IdCard className="size-4" />
          <span className="hidden sm:inline">{user?.email}</span>
        </span>
        <a
          href={TROOPITER_SIGN_OUT_URL}
          className="text-sm text-blue-700 dark:text-blue-400 underline-offset-2 hover:underline"
        >
          Log Out
        </a>
      </div>
    </header>
  )
}

export default function DashboardLayout({ children, banner, headerActions }) {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const { skin, org } = useSkin()
  const isTroopiter = skin === 'troopiter'
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)


  
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (!isLoading && user && user.onboarding_complete !== true && pathname !== '/dashboard/onboarding') {
      router.replace('/dashboard/onboarding')
    }
  }, [user, isLoading, router, pathname])

  if (!mounted) return null
  if (isLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading session...
      </div>
    );
  }
  if (!user) return null

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <SystemMessageBanner />
        {!isTroopiter && banner}
        {isTroopiter ? (
          <TroopiterHeader user={user} org={org} headerActions={headerActions} />
        ) : (
          <header className="flex min-h-16 shrink-0 items-center gap-2 py-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:min-h-12">
            <div className="flex flex-1 flex-wrap items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href="/dashboard">Dashboard</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>

                  {segments.filter((_,i)=> i!== 0).map((segment, index) => {
                    // Segments that don't have a real page at their computed href
                    const SEGMENT_MAP = {
                      network: { label: 'Networks', href: null }, // no /dashboard/network index page
                      admin:   { label: 'Admin',    href: null }, // no /dashboard/admin page
                      rides:   { label: 'Rides',    href: null }, // no /dashboard/network/[id]/rides index page
                    }
                    const override = SEGMENT_MAP[segment]
                    const href = override !== undefined
                      ? override.href
                      : '/' + segments.slice(0, index + 2).join('/')
                    // Filtered array is one shorter than segments (dashboard is skipped),
                    // so the last filtered index is segments.length - 2
                    const isLast = index === segments.length - 2
                    const stripped = segment.replace(/^network-/i, '')
                    const label = override?.label ?? (stripped.charAt(0).toUpperCase() + stripped.slice(1).toLowerCase())

                    return (
                      <div key={index} className="flex items-center">
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          {isLast || href === null ? (
                            <span className="text-muted-foreground">{label}</span>
                          ) : (
                            <BreadcrumbLink asChild>
                              <Link href={href}>{label}</Link>
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                      </div>
                    )
                  })}
                </BreadcrumbList>
              </Breadcrumb>
              {headerActions && <div className="ml-auto pr-2">{headerActions}</div>}
            </div>
          </header>
        )}
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 pb-20">
          {children}
        </div>
      </SidebarInset>
      <FeedbackWidget />
    </SidebarProvider>
  )
}
