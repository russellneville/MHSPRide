'use client'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "../../../dashboardLayout";
import { useState } from "react";
import { useNetwork } from "@/context/NetworksContext";
import DatePicker from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { ArrowRight, Car, MapPin, MapPinned, Users } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function FindRidePage() {
    const [rideData, setRideData] = useState({
        departure: '',
        arrival: '',
        departure_date: '',
        num_seats: 0
    });
    const [availableRides, setAvailableRides] = useState([]);
    const [date, setDate] = useState(undefined);
    const [validationError, setValidationErrors] = useState({});
    const { isLoading, findRide } = useNetwork();
    const { networkId } = useParams();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const validateForm = () => {
        const newErrors = {};
        if (!rideData.departure.trim()) newErrors.departure = "Ride departure is required";
        if (!rideData.arrival.trim()) newErrors.arrival = "Ride arrival is required";
        if (!rideData.departure_date) newErrors.departure_date = "Ride departure date is required";
        setValidationErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        setRideData(prev => ({ ...prev, [e.target.id]: e.target.value.toLowerCase() }));
    };

    const handleDateChange = (selectedDate) => {
        setDate(selectedDate);
        setRideData(prev => ({
            ...prev,
            departure_date: selectedDate ? selectedDate.toLocaleDateString("en-CA") : "",
        }));
    };

    const handleFindRide = async () => {
        if (!validateForm()) return;
        setLoading(true);
        try {
            const rides = await findRide(rideData, networkId);
            setAvailableRides(rides);
        } finally {
            setLoading(false);
        }
    };

    const getRideDuration = (departure_date, departure_time, arrival_date, arrival_time) => {
        if (!departure_date || !departure_time || !arrival_date || !arrival_time) return "—";
        const start = new Date(`${departure_date}T${departure_time}`);
        const end = new Date(`${arrival_date}T${arrival_time}`);
        const diffMs = end - start;
        if (diffMs <= 0) return "Invalid";
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h${minutes > 0 ? `${minutes}min` : ""}`;
    };

    return (
        <DashboardLayout>
            {user ? (
                <>
                    <Card className="mb-5">
                        <CardHeader className='!pb-3 border-b border-border'>
                            <CardTitle>Find Ride</CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-4'>
                            <div className="flex flex-col sm:flex-row gap-4 w-full">
                                {/* Departure */}
                                <div className="flex-1 space-y-2">
                                    <InputGroup>
                                        <InputGroupAddon><MapPin /></InputGroupAddon>
                                        <InputGroupInput
                                            id="departure"
                                            type="text"
                                            placeholder='Departure location'
                                            value={rideData.departure}
                                            onChange={handleChange}
                                        />
                                    </InputGroup>
                                    {validationError.departure && <p className="text-red-500 text-sm">{validationError.departure}</p>}
                                </div>

                                {/* Arrival */}
                                <div className="flex-1 space-y-2">
                                    <InputGroup>
                                        <InputGroupAddon><MapPinned /></InputGroupAddon>
                                        <InputGroupInput
                                            id="arrival"
                                            type="text"
                                            placeholder='Arrival location'
                                            value={rideData.arrival}
                                            onChange={handleChange}
                                        />
                                    </InputGroup>
                                    {validationError.arrival && <p className="text-red-500 text-sm">{validationError.arrival}</p>}
                                </div>

                                {/* Date */}
                                <div className="flex-1 space-y-2">
                                    <DatePicker
                                        id="departure_date"
                                        date={rideData.departure_date ? new Date(rideData.departure_date) : undefined}
                                        setDate={handleDateChange}
                                        disabled={{ before: new Date() }}
                                    />
                                    {validationError.departure_date && <p className="text-red-500 text-sm">{validationError.departure_date}</p>}
                                </div>

                                <div className="flex-1 flex items-center justify-center sm:justify-start">
                                    <Button onClick={handleFindRide} disabled={loading} className="w-full sm:w-auto">
                                        {loading ? 'Finding...' : 'Find Ride'}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Rides */}
                    <div className="space-y-4">
                        {availableRides.length >= 1 ? (
                            <>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
                                    <div className="flex gap-2 flex-wrap items-center">
                                        <span className="font-semibold">{rideData.departure_date}</span>
                                        {rideData.departure} <ArrowRight /> {rideData.arrival}
                                    </div>
                                    <div>{availableRides.length} available ride{availableRides.length > 1 ? 's' : ''}</div>
                                </div>

                                <div className="space-y-2">
                                    {availableRides.map(ride => (
                                        <Card key={ride.id}>
                                            <CardHeader className='flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border gap-3'>
                                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 w-full sm:w-auto">
                                                    <div className="text-sm">
                                                        <span className="block font-semibold">{ride.departure_time}</span>
                                                        <span>{ride.departure}</span>
                                                    </div>

                                                    <span className="h-2 w-full sm:w-60 max-w-full rounded-full bg-black flex justify-center items-center">
                                                        <div className="bg-background p-2 text-sm">
                                                            {getRideDuration(ride.departure_date, ride.departure_time, ride.arrival_date, ride.arrival_time)}
                                                        </div>
                                                    </span>

                                                    <div className="text-sm">
                                                        <span className="block font-semibold">{ride.arrival_time}</span>
                                                        <span>{ride.arrival}</span>
                                                    </div>
                                                </div>

                                            </CardHeader>

                                            <CardContent className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3'>
                                                <div className="flex gap-4 flex-wrap">
                                                    <div className="flex items-center gap-2"><Car /> {ride.driver.fullname}</div>
                                                    <div className="flex items-center gap-2"><Users /> {ride.total_seats - ride.available_seats} / {ride.total_seats}</div>
                                                </div>
                                                <Button href={`/dashboard/network/${networkId}/rides/${ride.id}`} className="mt-2 sm:mt-0">Book Now</Button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </>
                        ) : <p>No rides found</p>}
                    </div>
                </>
            ) : <p>You don't have access to this page</p>}
        </DashboardLayout>
    )
}
