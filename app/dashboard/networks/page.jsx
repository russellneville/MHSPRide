"use client";
import DashboardLayout from "../dashboardLayout";
import { Button } from "@/components/ui/button";
import { usePopup } from "@/context/PopupContext";
import NetworkPopup from "@/components/popup-forms/NetworkPopup";
import { useNetwork } from "@/context/NetworksContext";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import Link from "next/link";

// The 3 fixed networks — display info lives here, no Firestore read needed to show them
const KNOWN_NETWORKS = [
  { id: "network-HILLPATROL",    name: "Hill Patrol",     description: "Alpine ski patrollers on the main mountain." },
  { id: "network-MOUNTAINHOSTS", name: "Mountain Hosts",  description: "Volunteer hosts welcoming guests at Timberline." },
  { id: "network-NORDIC",        name: "Nordic",          description: "Nordic and backcountry patrol volunteers." },
]

export default function NetworksPage() {
  const { openPopup } = usePopup();
  const { joinNetwork, getNetworkList } = useNetwork();
  const [joinedIds, setJoinedIds] = useState([]);
  const [joiningId, setJoiningId] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    getNetworkList()
      .then(list => setJoinedIds((list || []).map(n => n.id)))
      .catch(err => console.error('[NetworksPage]', err));
  }, [user]);

  const handleJoin = async (networkId) => {
    setJoiningId(networkId);
    await joinNetwork(networkId);
    const list = await getNetworkList();
    setJoinedIds((list || []).map(n => n.id));
    setJoiningId(null);
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Networks</h3>
        {user?.role === "director" && (
          <Button onClick={() => openPopup("Create new Network", <NetworkPopup />)}>
            Create Network
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {KNOWN_NETWORKS.map(net => {
          const joined = joinedIds.includes(net.id);
          const joining = joiningId === net.id;
          return (
            <Card key={net.id} className={joined ? "border-primary/50" : ""}>
              <CardHeader className="border-b border-border pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{net.name}</CardTitle>
                  {joined && <Badge variant="secondary">Joined</Badge>}
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                <p className="text-sm text-muted-foreground">{net.description}</p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                {joined ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/network/${net.id}`}>View</Link>
                  </Button>
                ) : (
                  <Button size="sm" disabled={joining} onClick={() => handleJoin(net.id)}>
                    {joining ? "Joining..." : "Join"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
