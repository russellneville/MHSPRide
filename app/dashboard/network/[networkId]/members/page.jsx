'use client'
import { useParams } from "next/navigation";
import DashboardLayout from "../../../dashboardLayout";
import { useNetwork } from "@/context/NetworksContext";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Car } from "lucide-react";

export default function MembersPage() {
  const { networkId } = useParams();
  const { getNetwork, getRidesByNetworkId } = useNetwork();
  const { user } = useAuth();

  const [members, setMembers] = useState([]);
  const [driverIds, setDriverIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !networkId) return;
    Promise.all([
      getNetwork(networkId),
      getRidesByNetworkId(networkId),
    ]).then(([net, rides]) => {
      // All members are in the passengers array (unified role model)
      const allMembers = [
        ...(net?.passengers || []),
        ...(net?.drivers || []),
      ];
      // Deduplicate by id
      const seen = new Set();
      const deduped = allMembers.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      setMembers(deduped);

      // Members who have offered at least one non-cancelled ride
      const ids = new Set(
        (rides || [])
          .filter(r => r.ride_status !== 'canceled')
          .map(r => r.driverId)
          .filter(Boolean)
      );
      setDriverIds(ids);
      setLoading(false);
    });
  }, [user, networkId]);

  if (loading) return <DashboardLayout><p className="p-6 text-muted-foreground">Loading…</p></DashboardLayout>;

  const offering = members
    .filter(m => driverIds.has(m.id))
    .sort((a, b) => a.fullname?.localeCompare(b.fullname));

  const others = members
    .filter(m => !driverIds.has(m.id))
    .sort((a, b) => a.fullname?.localeCompare(b.fullname));

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <h3 className="text-xl font-semibold">Members</h3>

        {/* Offering rides */}
        {offering.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Car className="size-4" /> Offering Rides
            </h4>
            <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
              {offering.map(m => <MemberRow key={m.id} member={m} isDriver />)}
            </div>
          </div>
        )}

        {/* Divider */}
        {offering.length > 0 && others.length > 0 && (
          <div className="border-t border-border" />
        )}

        {/* Other members */}
        {others.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Members
            </h4>
            <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
              {others.map(m => <MemberRow key={m.id} member={m} />)}
            </div>
          </div>
        )}

        {members.length === 0 && (
          <p className="text-muted-foreground text-sm">No members yet.</p>
        )}
      </div>
    </DashboardLayout>
  );
}

function MemberRow({ member, isDriver }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-card">
      <UserAvatar user={member} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{member.fullname}</p>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>
      {isDriver && (
        <Badge variant="secondary" className="shrink-0 flex items-center gap-1">
          <Car className="size-3" /> Offering rides
        </Badge>
      )}
    </div>
  );
}
