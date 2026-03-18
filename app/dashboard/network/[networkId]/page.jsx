'use client'
import { useParams } from "next/navigation";
import DashboardLayout from "../../dashboardLayout";
import { useNetwork } from "@/context/NetworksContext";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Car, CarFront, Plus, Trash, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePopup } from "@/context/PopupContext";
import OfferRidePopup from "@/components/popup-forms/OfferRidePopup";
import StatsCard from "@/components/ui/stats-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function NetworkPage(){
    const params = useParams(); 
    const { networkId } = params;
    const [networkData , setNetworkData] = useState(null)
    const { isLoading , getNetwork , deleteNetwork , getRidesByNetworkId} = useNetwork()
    const { user } = useAuth()
    const { openPopup } = usePopup()
    const [rides, setRides] = useState([])
      useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      const networkRides = await getRidesByNetworkId(networkId)
      setRides(networkRides)
    }

    fetchData()
  }, [user])

 

    const handleDeleteNetwork = async ()=>{
        let confirmed = confirm('Are you sure you want to delete ?')
        if(confirmed) await deleteNetwork(networkId)
    }
 

    useEffect(() => {
    const fetchNetwork = async () => {
        if (!user) return;
        const data = await getNetwork(networkId);
        setNetworkData(data);
    };

    if (networkId) fetchNetwork();
  }, [networkId, user ]);


    return <DashboardLayout>
        {!networkData ? <p>Network unfound!!</p> : 
        <>
            <div className="flex items-center justify-between">
                <h3 className="text-xl"><span className="font-semibold">{networkData.name}</span>'s network</h3>
                <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                        Network ID: <span className="font-medium">{networkId}</span>
                    </p>
                    <Button className='rounded-md' onClick={()=> openPopup('Offer ride' , <OfferRidePopup networkId={networkId}/>)}>
                        Offer Ride<Plus/>
                    </Button>
                    <Button variant='outline' className='rounded-md' href={`/dashboard/network/${networkId}/find`}>
                        Find Ride
                    </Button>
                    {user?.role === 'director' && (
                        <Button variant='destructive' className='size-10 p-2 rounded-full' onClick={handleDeleteNetwork}>
                            <Trash/>
                        </Button>
                    )}


                    
                    
                </div>
            </div>

           
                        
                            <div className="space-y-3">
                                <div className="grid grid-cols sm:grid-cols-3 gap-2">

                                    <StatsCard title='total drivers' icon={CarFront} statnumber={networkData.drivers.length}/>
                                    <StatsCard title='total passengers' icon={Users} statnumber={networkData.passengers.length}/>
                                    <StatsCard title="Total Rides" statnumber={rides.length} icon={Car} />
                                </div>
                                <div className="space-y-2">
                                    <h3>passengers</h3>
                                    <Table className='border border-border'>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>full name</TableHead>
                                                <TableHead>email</TableHead>
                                                <TableHead>joined at</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                                {networkData.passengers.map(p => <TableRow key={p.id}>
                                                    <TableCell>{p.fullname}</TableCell>
                                                    <TableCell>{p.email}</TableCell>
                                                    <TableCell>{p.joined_at.toDate().toISOString().split('T')[0]}</TableCell>
                                                </TableRow>)}
                                        </TableBody>
                                    </Table>
                                </div>

                                <div className="space-y-2">
                                    <h3>Drivers</h3>
                                    <Table className='border border-border'>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>full name</TableHead>
                                                <TableHead>email</TableHead>
                                                <TableHead>joined at</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                                {networkData.drivers.map(p => <TableRow key={p.id}>
                                                    <TableCell>{p.fullname}</TableCell>
                                                    <TableCell>{p.email}</TableCell>
                                                    <TableCell>{p.joined_at.toDate().toISOString().split('T')[0]}</TableCell>
                                                </TableRow>)}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                            <div>
                                
                                
                            </div>
                       
                    
                    </>}
        
    </DashboardLayout>
}