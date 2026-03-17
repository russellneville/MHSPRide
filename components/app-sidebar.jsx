"use client"

import {
  Car,
  Home,
  MapPin,
  Settings,
  User,
  Users,
  Waypoints,
  ShipWheel,
  PlusCircle,
  ClipboardList,
  Ticket,
} from "lucide-react"

import Image from "next/image"
import { NavMain } from "./nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

export function AppSidebar({ user, ...props }) {
  const menu = [
    { name: "Home", icon: Home, href: "/dashboard" },
    { name: "Profile", icon: User, href: "/dashboard/profile" },
    { name: "Networks", icon: Users, href: "/dashboard/networks" },
    { name: "My Rides", icon: Waypoints, href: "/dashboard/rides" },
    { name: "My Bookings", icon: Ticket, href: "/dashboard/bookings" },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Header */}
      <SidebarHeader className="p-0">
        {/* Expanded: full-width transparent logo */}
        <div className="group-data-[collapsible=icon]:hidden w-full px-3 py-3">
          <Image
            src="/assets/mhspride_alt_logo.png"
            alt="MHSPRide"
            width={423}
            height={286}
            className="w-full h-auto"
          />
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

      {/* Mountain photo panel — hidden when collapsed to icon mode */}
      <div className="group-data-[collapsible=icon]:hidden relative mx-0 overflow-hidden">
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

      {/* Content */}
      <SidebarContent>
        <NavMain menu={menu} />
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
