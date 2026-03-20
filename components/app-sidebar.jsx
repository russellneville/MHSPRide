"use client"

import {
  Activity,
  BarChart2,
  Car,
  ClipboardList,
  Home,
  MapPin,
  Settings,
  Ticket,
  User,
  Users,
  Waypoints,
  ShipWheel,
  PlusCircle,
} from "lucide-react"

import Image from "next/image"
import { NavMain } from "./nav-main"
import { NavUser } from "@/components/nav-user"
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

const ADMIN_MENU = [
  { name: "Users",        icon: Users,         href: "/dashboard/admin/users" },
  { name: "Rides",        icon: Car,           href: "/dashboard/admin/rides" },
  { name: "Bookings",     icon: ClipboardList, href: "/dashboard/admin/bookings" },
  { name: "Activity Log", icon: Activity,      href: "/dashboard/admin/activity-log" },
  { name: "Reports",      icon: BarChart2,     href: "/dashboard/admin/reports" },
]

export function AppSidebar({ user, ...props }) {
  const menu = [
    { name: "Home", icon: Home, href: "/dashboard" },
    { name: "My Booked Rides", icon: Ticket, href: "/dashboard/bookings" },
    { name: "My Offered Rides", icon: Waypoints, href: "/dashboard/rides" },
    { name: "Book/Offer Rides", icon: Users, href: "/dashboard/networks" },
    { name: "Profile", icon: User, href: "/dashboard/profile" },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Header */}
      <SidebarHeader className="p-0">
        {/* Expanded: full-width transparent logo */}
        <div className="group-data-[collapsible=icon]:hidden w-full px-3 py-3">
          <div className="rounded-xl overflow-hidden bg-white">
          <Image
            src="/assets/mhspride_alt_logo.png"
            alt="MHSPRide"
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
            alt="MHSPRide"
            height={28}
            width={28}
          />
        </div>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent>
        <NavMain menu={menu} />

        {user?.role === 'admin' && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarMenu>
                {ADMIN_MENU.map(item => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton href={item.href} tooltip={item.name}>
                      <item.icon />
                      <span>{item.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}
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
