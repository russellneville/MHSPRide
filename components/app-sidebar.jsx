"use client"

import { useEffect, useState } from "react"
import {
  Activity,
  BarChart2,
  Building2,
  Car,
  ExternalLink,
  FileText,
  HelpCircle,
  Home,
  List,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Settings,
  Shield,
  Upload,
  User,
  Users,
} from "lucide-react"

import Image from "next/image"
import { NavMain } from "./nav-main"
import { NavUser } from "@/components/nav-user"
import { db } from "@/lib/firebaseClient"
import { collection, onSnapshot } from "firebase/firestore"
import { useSkin } from "@/context/SkinContext"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"

const ADMIN_ROLES = ["admin", "super-admin"]

// superAdminOnly items are gated to role === 'super-admin' (issue #107) —
// their pages are wrapped in SuperAdminGuard, this just keeps them out of a
// plain admin's nav.
const ADMIN_MENU = [
  { name: "Users",          icon: Users,         href: "/dashboard/admin/users" },
  { name: "Roster",         icon: List,          href: "/dashboard/admin/roster" },
  { name: "Rides",          icon: Car,           href: "/dashboard/admin/rides" },
  { name: "Roster Import",  icon: Upload,        href: "/dashboard/admin/roster-import", superAdminOnly: true },
  { name: "Locations",      icon: MapPin,        href: "/dashboard/admin/locations", superAdminOnly: true },
  { name: "Organizations",  icon: Building2,     href: "/dashboard/admin/organizations", superAdminOnly: true },
  { name: "Activity Log",   icon: Activity,      href: "/dashboard/admin/activity-log" },
  { name: "Feedback",       icon: MessageSquare, href: "/dashboard/admin/feedback" },
  { name: "Reports",        icon: BarChart2,     href: "/dashboard/admin/reports" },
  { name: "Settings",       icon: Settings,      href: "/dashboard/admin/settings", superAdminOnly: true },
  // Not an MHSP Ride admin feature — a standalone, unauthenticated page
  // (app/troopiter-shift-demo) that mimics Troopiter's own shift UI, for
  // rehearsing the launch handoff. Opens in a new tab since it's meant to
  // feel like leaving MHSP Ride the way a real Troopiter link would.
  { name: "Troopiter Shift Demo", icon: ExternalLink, href: "/troopiter-shift-demo", superAdminOnly: true, external: true },
]

export function AppSidebar({ user, ...props }) {
  const { skin, org } = useSkin()
  const menu = [
    { name: "Home", icon: Home, href: "/dashboard" },
    { name: "Profile", icon: User, href: "/dashboard/profile" },
    { name: "Security", icon: Shield, href: "/dashboard/security" },
    { name: "FAQ", icon: HelpCircle, href: "/dashboard/faq" },
  ]

  const [unrespondedFeedbackCount, setUnrespondedFeedbackCount] = useState(0)

  useEffect(() => {
    if (!ADMIN_ROLES.includes(user?.role)) return
    const unsub = onSnapshot(collection(db, 'feedback'), snap => {
      setUnrespondedFeedbackCount(snap.docs.filter(d => !d.data().responded).length)
    })
    return () => unsub()
  }, [user?.role])

  const visibleAdminMenu = ADMIN_MENU.filter(item => !item.superAdminOnly || user?.role === 'super-admin')

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Header */}
      <SidebarHeader className="p-0">
        {skin === 'troopiter' ? (
          <>
            {/* Expanded: org logo (falls back to the troopiter wordmark if the org hasn't uploaded one) —
                no org name here, it already appears next to this same logo in the page header (TroopiterHeader) */}
            <div className="group-data-[collapsible=icon]:hidden w-full px-3 py-3 flex items-center gap-2">
              {org?.logoUrl ? (
                <img src={org.logoUrl} alt={org?.displayName || 'Troopiter'} className="h-8 w-8 rounded object-contain bg-white" />
              ) : (
                <Image src="/assets/troopiter-ride.png" alt="troopiter" width={132} height={21} className="h-5 w-auto" />
              )}
            </div>
            {/* Collapsed: just the org logo or initial */}
            <div className="group-data-[collapsible=icon]:flex hidden justify-center py-3">
              {org?.logoUrl ? (
                <img src={org.logoUrl} alt={org?.displayName || 'Troopiter'} className="h-7 w-7 rounded object-contain bg-white" />
              ) : (
                <span className="font-[family-name:var(--font-inter)] font-bold text-[#126D41]">T</span>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Expanded: full-width transparent logo */}
            <div className="group-data-[collapsible=icon]:hidden w-full px-3 py-3">
              <div className="rounded-xl overflow-hidden bg-white">
              <Image
                src="/assets/mhspride_alt_logo.png"
                alt="MHSP Ride"
                width={423}
                height={286}
                className="w-full h-auto"
              />
              </div>
            </div>
            {/* Collapsed: small shield icon centered */}
            <div className="group-data-[collapsible=icon]:flex hidden justify-center py-3">
              <Image
                src="/assets/mhsp_main_logo.png"
                alt="MHSP Ride"
                height={28}
                width={28}
              />
            </div>
          </>
        )}
      </SidebarHeader>

      {/* Content */}
      <SidebarContent>
        <NavMain menu={menu} />

        {ADMIN_ROLES.includes(user?.role) && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarMenu>
                {visibleAdminMenu.map(item => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      href={item.href}
                      tooltip={item.name}
                      {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      <item.icon />
                      <span>
                        {item.name}
                        {item.href === '/dashboard/admin/feedback' && unrespondedFeedbackCount > 0 && (
                          <> <strong>({unrespondedFeedbackCount})</strong></>
                        )}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}

        <SidebarSeparator />
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton href="/contact" tooltip="Contact Us">
                <Mail />
                <span>Contact Us</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton href="/terms" tooltip="Terms and Conditions">
                <FileText />
                <span>Terms and Conditions</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton href="/privacy" tooltip="Privacy Policy">
                <Lock />
                <span>Privacy Policy</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Mountain photo panel — hidden when collapsed to icon mode */}
      <div className="group-data-[collapsible=icon]:hidden relative mx-3 rounded-xl overflow-hidden mb-2">
        <img
          src="/assets/hood_1.jpg"
          alt="Mt. Hood"
          className="h-32 w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30 flex items-end justify-center pb-3">
          <span className="text-white text-[10px] font-bold tracking-widest uppercase text-center px-2 leading-tight">
            Teamwork Makes the Mountain Shine
          </span>
        </div>
      </div>

      {/* Footer */}
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
