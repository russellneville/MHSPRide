"use client";
import DashboardLayout from "../dashboardLayout";
import { Button } from "@/components/ui/button";
import { usePopup } from "@/context/PopupContext";
import NetworkPopup from "@/components/popup-forms/NetworkPopup";
import { useNetwork } from "@/context/NetworksContext";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, User2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function NetworksPage() {
  const { openPopup } = usePopup();
  const { getAllNetworks, joinNetwork } = useNetwork();
  const [networks, setNetworks] = useState([]);
  const [joiningId, setJoiningId] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getAllNetworks()
      .then(data => setNetworks(data || []))
      .catch(err => console.error('[NetworksPage]', err))
      .finally(() => setLoading(false));
  }, [user]);

  const isMember = (net) => {
    if (!user) return false;
    return net.passengersIds?.includes(user.uid) || net.driversIds?.includes(user.uid);
  };

  const handleJoin = async (networkId) => {
    setJoiningId(networkId);
    await joinNetwork(networkId);
    const updated = await getAllNetworks();
    setNetworks(updated || []);
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

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading networks...</p>
      ) : networks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No networks found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {networks.map(net => {
            const joined = isMember(net);
            const joining = joiningId === net.id;
            return (
              <Card key={net.id} className={joined ? "border-primary/40" : ""}>
                <CardHeader className="border-b border-border pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{net.name}</CardTitle>
                    {joined && <Badge variant="secondary">Joined</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="pt-3 flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User2 className="h-4 w-4" /> {net.passengers?.length || 0} members
                  </span>
                  <span className="flex items-center gap-1">
                    <Car className="h-4 w-4" /> {net.drivers?.length || 0} drivers
                  </span>
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
      )}
    </DashboardLayout>
  );
}
