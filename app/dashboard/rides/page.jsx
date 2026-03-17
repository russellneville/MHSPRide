'use client'
import { useNetwork } from "@/context/NetworksContext";
import DashboardLayout from "../dashboardLayout";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EllipsisVertical } from "lucide-react";

export default function MyBookings (){
    const { getRides } = useNetwork()
    const { user } = useAuth()
    const [rides , setRides] = useState([])
    
     useEffect(() => {
        const fetchRides = async () => {
            const data = await getRides();
            setRides(data);
            console.log(rides)
        };
    
        if (user) fetchRides();
      }, [user]);
    
    return <DashboardLayout>
        {user && <>
        
            <div className="flex items-center justify-betwee py-3">
            <h3 className="text-xl font-semibold py-2">My Rides</h3>
            
        </div>


        <Table className='border border-border overflow-x-auto'>
            <TableHeader>
                <TableRow>
                    <TableHead>
                        #
                    </TableHead>

                    <TableHead>
                        departure
                    </TableHead>

                    

                    <TableHead>
                        arrival
                    </TableHead>

                    <TableHead>
                        departure_date
                    </TableHead>
                    
                    <TableHead>
                        arrival_date
                    </TableHead>

                    <TableHead>
                        status
                    </TableHead>

                    <TableHead>
                        booked_seats
                    </TableHead>

                    <TableHead>
                        available_seats
                    </TableHead>

                </TableRow>
            </TableHeader>

            <TableBody>
                {rides.map(r => <TableRow key={r.id}>
                    <TableCell>
                        <a href={`/dashboard/network/${r.network_id}/rides/${r.id}`}>{r.id}</a>
                    </TableCell>


                    <TableCell>
                        {r.departure}
                    </TableCell>

                    <TableCell>
                        {r.arrival}
                    </TableCell>

                    <TableCell>
                        {r.departure_date} at {r.departure_time}
                    </TableCell>

                    <TableCell>
                        {r.arrival_date} at {r.arrival_time}
                    </TableCell>

                    <TableCell>
                        <Badge variant={r.ride_status}>{r.ride_status}</Badge>
                    </TableCell>


                    <TableCell>
                        {r.total_seats - r.available_seats}
                    </TableCell>

                    <TableCell>
                        {r.available_seats}
                    </TableCell>
                </TableRow>)}
            </TableBody>
        </Table>
        </>}

        
    </DashboardLayout>
}