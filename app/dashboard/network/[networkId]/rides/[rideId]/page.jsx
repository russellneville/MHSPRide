"use client";

import DashboardLayout from "@/app/dashboard/dashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNetwork } from "@/context/NetworksContext";
import {
  Clock,
  MapPin,
  Navigation,
  Users,
  Car,
  MoveRight,
  User,
  Info,
  Phone,
  Mail,
  Calendar,
  X,
  Check,
  CircleCheck,
  Settings,
  CarFront,
  BookText,
  Calendar1,
  UserRound,
  UserRoundX,
} from "lucide-react";
import { Badge } from '@/components/ui/badge'
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";

export default function RidePage() {
  const { rideId, networkId } = useParams();
  const { getRide, isLoading, bookRide , changeBookingStatus , cancelRide , startRide , 
    finalizeRide
  } = useNetwork();
  const { user } = useAuth();

  const [rideData, setRideData] = useState(null);
  const [seatsToBook, setSeatsToBook] = useState(1);
  const [readyTostart , setReadyTostart] = useState(false)


   const fetchRide = async () => {
      const data = await getRide(rideId, networkId);
      setRideData(data);

      if (data?.departure_date && data?.departure_time) {
        const rideDateTime = new Date(`${data.departure_date}T${data.departure_time}`);
        const now = new Date();

        // 30 minutes after scheduled time
        const thirtyMinutesAfter = new Date(rideDateTime.getTime() + 30 * 60 * 1000);

        // set true only if now is between scheduled time and +30min
        if (now >= rideDateTime && now <= thirtyMinutesAfter) {
          setReadyTostart(true);
        } else {
          setReadyTostart(false);
        }

         if (now > thirtyMinutesAfter && data.ride_status === 'not started') {
          await handleCancelRide()
        }
      }
    };
  useEffect(() => {
   
    if (rideId) fetchRide();
  }, [user , rideId, networkId]);

  const handleBookSeats = async () => {
    if (!rideData) return;
    await bookRide({ ...rideData, rideId }, seatsToBook, networkId);
    fetchRide()
  };


  const handledeclinePassenger = async (passengerId , bookingId)=>{
    await changeBookingStatus(passengerId  , rideId , bookingId , 'declined')
    fetchRide()
  }

  const handleApprovePassenger = async (passengerId , bookingId)=>{
    await changeBookingStatus(passengerId  , rideId , bookingId , 'approved')
    fetchRide()
  }

  const handleStartRide = async ()=>{
    await startRide(rideId)
    fetchRide()
  }

    const handleCancelRide = async ()=>{
    await cancelRide(rideId)
    fetchRide()
  }

  const handlefinalizeRide = async ()=> {
    await finalizeRide(rideId)
    fetchRide()
  }

  const formatDate = (date) => {
    if (!date) return "—";
    const d = new Date(date.seconds ? date.seconds * 1000 : date);
    return d.toLocaleString();
  };

  
  const currentBooking = rideData?.passengers?.find(
    (p) => p.id === user?.uid
  );

  const isRideDriver = rideData?.driverId === user?.uid;

  return (
    <DashboardLayout>
      {rideData ? (
        <div className="space-y-5 p-3 md:p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-2xl font-semibold">Ride Details</h2>
            <p className="text-sm text-muted-foreground">
              Ride ID: <span className="font-medium">{rideId}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[7fr_3fr] gap-5">
            {/* LEFT SIDE */}
            <div className="space-y-4">
              {/* Ride Info */}
              <Card>
                <CardHeader className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-secondary flex items-center justify-center">
                    <Car className="text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold flex items-center gap-3">
                      {rideData.departure} <MoveRight className="size-4" />{" "}
                      {rideData.arrival}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="size-4" />
                      {rideData.departure_date} at {rideData.departure_time}
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    <MapPin className="inline size-4 mr-1" />{" "}
                    <span className="font-medium">Departure:</span>{" "}
                    {rideData.departure}
                  </p>
                  <p>
                    <Navigation className="inline size-4 mr-1" />{" "}
                    <span className="font-medium">Arrival:</span>{" "}
                    {rideData.arrival}
                  </p>
                  <p>
                    <Users className="inline size-4 mr-1" />{" "}
                    <span className="font-medium">Seats Available:</span>{" "}
                    {rideData.available_seats}
                  </p>
                  <p>
                    <Info className="inline size-4 mr-1" />{" "}
                    <span className="font-medium">Description:</span>{" "}
                    {rideData.ride_description || "No description provided."}
                  </p>

                  <p>
                    <CircleCheck className="inline size-4 mr-1" />{" "}
                    <span className="font-medium">Ride status:</span>{" "}
                    <Badge variant={rideData.ride_status}>
                      {rideData.ride_status || "No description provided."}
                    </Badge>
                  </p>
                </CardContent>
              </Card>

              {/* Driver Info */}
              <Card>
                <CardHeader className="flex items-center gap-3">
                  <UserAvatar user={rideData.driver} size="lg" />
                  <CardTitle className="text-lg font-semibold">
                    Driver Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>
                    <span className="font-medium text-foreground">Name:</span>{" "}
                    {rideData.driver?.fullname || "Unknown"}
                  </p>
                  <p>
                    <Mail className="inline size-4 mr-1" />{" "}
                    <span className="font-medium text-foreground">Email:</span>{" "}
                    {rideData.driver?.email || "Not provided"}
                  </p>
                  <p>
                    <Phone className="inline size-4 mr-1" />{" "}
                    <span className="font-medium text-foreground">Phone:</span>{" "}
                    {rideData.driver?.phone || "Not provided"}
                  </p>
                  <p>
                    <Car className="inline size-4 mr-1" />{" "}
                    <span className="font-medium text-foreground">Car:</span>{" "}
                    {[rideData.driver?.vehicle_make, rideData.driver?.vehicle_model].filter(Boolean).join(" ") || "Not specified"}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Car Plate:</span>{" "}
                    {rideData.driver?.vehicle_plate || "—"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT SIDE */}
            <div className="space-y-4">
            
              {(isRideDriver || user?.role === "director") && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Users className="size-4" />
                      Passengers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {rideData?.passengers?.length > 0 ? (
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {rideData.passengers.map((p, i) => (
                          <li
                            key={i}
                            className="border rounded-lg p-2 hover:bg-accent transition"
                          >
                              <p className="font-medium text-foreground">
                                {p.fullname}
                              </p>
                              <p className="flex items-center gap-1">
                                <Mail className="size-3" /> {p.email}
                              </p>
                              <p className="flex items-center gap-1">
                                <Phone className="size-3" /> {p.phone}
                              </p>
                              <p>
                                Seats booked:{" "}
                                <span className="font-medium text-foreground">
                                  {p.booked_seats || 1}
                                </span>
                              </p>
                              <p className="flex items-center gap-1">
                                <Calendar className="size-3" />{" "}
                                {formatDate(p.booked_at)}
                              </p>
                              <p className="flex items-center gap-1">
                                Status : {" "}
                                {<Badge variant={p.status}>{p.status}</Badge>}
                              </p>
                              {p.status === 'pending' && isRideDriver && (<div className="flex items-center gap-2 mt-2">
                                <Button variant='destructive' disabled={isLoading} onClick={() =>{handledeclinePassenger(p.id , p.booking_id)}}>{isLoading ? 'Declining...' : 'Decline'} <X/></Button>
                                <Button variant='approved' disabled={isLoading} onClick={() =>{handleApprovePassenger(p.id , p.booking_id)}}>{isLoading ? 'Approving...' : 'Approve'} <Check/></Button>
                            </div>)}
                            
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No passengers yet.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}


              {isRideDriver && rideData.ride_status !== 'finished' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Settings className="size-4" />
                      Manage Ride
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Button variant='destructive' onClick={handleCancelRide} disabled={rideData.ride_status === 'cancled' || rideData.ride_status !== 'not started' || isLoading || readyTostart}>
                        Cancel ride
                        <X/>
                        </Button>
                      {rideData.ride_status === 'on progress' ? 
                      <Button disabled={isLoading} onClick={handlefinalizeRide}>Finalize Ride <Check/></Button> : 
                      <Button disabled={!readyTostart || isLoading} onClick={handleStartRide}>
                        Start ride <CarFront/>
                        </Button>}
                    </div>
                  </CardContent>
              </Card>)}


              

              {/* Passenger booking section */}
              {!isRideDriver && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Users className="size-4" />
                      Book Your Seats
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {currentBooking ? (
                      <div className="border rounded-md p-3 bg-secondary/30">
                        <p className="font-medium text-foreground">
                          {currentBooking.status === 'pending' && 'wait for driver approval'}
                        </p>
                        <p className="text-sm">
                          <strong>Seats:</strong> {currentBooking.seats || 1}
                        </p>
                        <p className="text-sm">
                          <strong>Status:</strong> <Badge variant={currentBooking.status}>
                            {currentBooking.status}
                          </Badge>
                        </p>
                        <p className="text-sm">
                          <strong>Booked at:</strong>{" "}
                          {formatDate(currentBooking.booked_at)}
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Choose how many seats you’d like to reserve.
                        </p>
                        <Input
                          type="number"
                          min={1}
                          max={rideData.available_seats}
                          value={seatsToBook}
                          onChange={(e) =>
                            setSeatsToBook(
                              Math.min(
                                Math.max(1, Number(e.target.value)),
                                rideData.available_seats
                              )
                            )
                          }
                          className="w-24"
                        />
                        <Button
                          onClick={handleBookSeats}
                          disabled={
                            seatsToBook < 1 ||
                            seatsToBook > rideData.available_seats ||
                            rideData.available_seats == 0 ||
                            isLoading
                          }
                          className="w-full"
                        >
                          {isLoading
                            ? "Booking..."
                            : `Book ${seatsToBook} Seat${seatsToBook > 1 ? "s" : ""}`}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}


              {/* Ride summary if finished */}
              {rideData.ride_status === 'finished' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <BookText className="size-4" />
                      Ride summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>
                    <Calendar1 className="inline size-4 mr-1" />{" "}
                    <span className="font-medium">Started at:</span>{" "}
                    {formatDate(rideData.started_at)}
                  </p>
                  <p>
                    <Calendar1 className="inline size-4 mr-1" />{" "}
                    <span className="font-medium">Finished at :</span>{" "}
                    {formatDate(rideData.finished_at)}
                  </p>
                  <p>
                    <Users className="inline size-4 mr-1" />{" "}
                    <span className="font-medium">Accepted passengers:</span>{" "}
                    {rideData.passengers.filter(p => p.status === 'approved').length}
                  </p>
                  <p>
                    <UserRoundX className="inline size-4 mr-1" />{" "}
                    <span className="font-medium">declined passengers:</span>{" "}
                    {rideData.passengers.filter(p => p.status === 'declined').length}
                  </p>
                  </CardContent>
              </Card>)}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-center p-5 text-muted-foreground">Ride not found.</p>
      )}
    </DashboardLayout>
  );
}
