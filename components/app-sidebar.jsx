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
      <SidebarHeader>
        <div className="flex items-center justify-center overflow-hidden px-2 py-3">
          {/* Expanded: show full title logo */}
          <Image
            className="group-data-[collapsible=icon]:hidden block"
            src="/assets/mhsp_title_logo.png"
            alt="MHSPRide"
            height={35}
            width={125}
          />
          {/* Collapsed icon mode: show small square logo */}
          <Image
            className="group-data-[collapsible=icon]:block hidden"
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
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
