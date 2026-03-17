'use client'
import { useNetwork } from "@/context/NetworksContext";
import DashboardLayout from "../dashboardLayout";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function MyBookings (){
    const { getBookings } = useNetwork()
    const { user } = useAuth()
    const [bookings , setBookings] = useState([])
    
     useEffect(() => {
        const fetchBookings = async () => {
            const data = await getBookings();
            setBookings(data);
        };
    
        if (user) fetchBookings();
      }, [user]);
    
    return <DashboardLayout>
        {user && <>
        
            <div className="flex items-center justify-betwee py-3">
            <h3 className="text-xl font-semibold py-2">My Bookings</h3>
            
        </div>


        <Table className='border border-border'>
            <TableHeader>
                <TableRow>
                    <TableHead>
                        #
                    </TableHead>

                    <TableHead>
                        ride_id
                    </TableHead>

                    <TableHead>
                        driver_id
                    </TableHead>

                    <TableHead>
                        booking status
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
                </TableRow>
            </TableHeader>

            <TableBody>
                {bookings.map(b => <TableRow key={b.id}>
                    <TableCell>
                        <a href={`/dashboard/bookings/${b.id}`}>{b.id}</a>
                    </TableCell>

                    <TableCell>
                        {b.ride_id}
                    </TableCell>

                    <TableCell>
                        {b.driver.id}
                    </TableCell>

                    <TableCell>
                        <Badge variant={b.booking_status}>
                            {b.booking_status}
                        </Badge>
                    </TableCell>

                    <TableCell>
                        {b.departure}
                    </TableCell>

                    <TableCell>
                        {b.arrival}
                    </TableCell>

                    <TableCell>
                        {b.departure_date} at {b.departure_time}
                    </TableCell>

                    <TableCell>
                        {b.arrival_date} at {b.arrival_time}
                    </TableCell>
                </TableRow>)}
            </TableBody>
        </Table>
        </>}

        
    </DashboardLayout>
}