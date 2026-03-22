'use client'
import { AppSidebar } from "@/components/app-sidebar"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { useAuth } from "@/context/AuthContext"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import FeedbackWidget from "@/components/ui/feedback-widget"

export default function DashboardLayout({ children, banner, headerActions }) {
  const router = useRouter()
  const { user, isLoading } = useAuth()
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
        {banner}
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex flex-1 items-center gap-2 px-4">
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
                    network: { label: 'Networks', href: '/dashboard/networks' },
                    admin:   { label: 'Admin',    href: null }, // no /dashboard/admin page
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
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
      <FeedbackWidget />
    </SidebarProvider>
  )
}
