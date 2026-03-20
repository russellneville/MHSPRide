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
  CircleCheck,
  Settings,
  BookText,
  Calendar1,
  UserRoundX,
  Pencil,
} from "lucide-react";
import { Badge } from '@/components/ui/badge'
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { usePopup } from "@/context/PopupContext";
import { formatTime } from "@/lib/utils";
import EditRidePopup from "@/components/popup-forms/EditRidePopup";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function RidePage() {
  const { rideId, networkId } = useParams();
  const { getRide, isLoading, bookRide, cancelRide, getBookings } = useNetwork();
  const { user } = useAuth();
  const { openPopup } = usePopup();

  const [rideData, setRideData] = useState(null);
  const [seatsToBook, setSeatsToBook] = useState(1);
  const [showEditWarn, setShowEditWarn] = useState(false);
  const [showDayConflict, setShowDayConflict] = useState(false);
  const [existingBookings, setExistingBookings] = useState([]);


  const fetchRide = async () => {
    const data = await getRide(rideId, networkId);
    setRideData(data);
  };

  useEffect(() => {
    if (rideId) fetchRide();
    if (user) getBookings().then(data => setExistingBookings(data || []));
  }, [user, rideId, networkId]);

  const handleBookSeats = async () => {
    if (!rideData) return;
    const alreadyBookedThatDay = existingBookings.some(
      b => b.departure_date === rideData.departure_date &&
           b.booking_status !== 'canceled' &&
           b.booking_status !== 'cancled'
    );
    if (alreadyBookedThatDay) {
      setShowDayConflict(true);
      return;
    }
    await bookRide({ ...rideData, rideId }, seatsToBook, networkId);
    fetchRide();
  };


  const handleCancelRide = async ()=>{
    await cancelRide(rideId)
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

  const inProgress = (() => {
    if (!rideData) return false
    const now       = new Date()
    const departure = new Date(`${rideData.departure_date}T${rideData.departure_time || '00:00'}`)
    const arrival   = rideData.arrival_time
      ? new Date(`${rideData.departure_date}T${rideData.arrival_time}`)
      : new Date(departure.getTime() + 4 * 60 * 60 * 1000)
    return now >= departure && now <= arrival
  })()

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

          {rideData.ride_status === 'canceled' && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 font-medium">
              This ride has been canceled.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[7fr_3fr] gap-5">
            {/* LEFT SIDE */}
            <div className="space-y-4">
              {/* Ride Info */}
              <Card>
                <CardHeader className="flex items-center gap-3">
                  <div className="relative size-12 shrink-0 flex items-center justify-center">
                    {inProgress && (
                      <div
                        className="absolute inset-0 rounded-full animate-spin"
                        style={{
                          background: 'conic-gradient(from 0deg, transparent 75%, rgba(74,222,128,0.85) 100%)',
                          animationDuration: '4s',
                          animationTimingFunction: 'linear',
                        }}
                      />
                    )}
                    <div className="size-11 rounded-full bg-green-600 flex items-center justify-center relative z-10">
                      <Car className="text-white" />
                    </div>
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold flex items-center gap-3 flex-wrap">
                      {rideData.departure} <MoveRight className="size-4" />{" "}
                      {rideData.arrival}
                      {inProgress && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300">
                          In Progress
                        </span>
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="size-4" />
                      {rideData.departure_date} at {formatTime(rideData.departure_time)}
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
                  {rideData.arrival_time && (
                    <p>
                      <Clock className="inline size-4 mr-1" />{" "}
                      <span className="font-medium">Arrives:</span>{" "}
                      {formatTime(rideData.arrival_time)}
                    </p>
                  )}
                  {!rideData.one_way && rideData.return_departure_time && (
                    <p>
                      <Clock className="inline size-4 mr-1" />{" "}
                      <span className="font-medium">Return departs:</span>{" "}
                      {formatTime(rideData.return_departure_time)}
                    </p>
                  )}
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


              {isRideDriver && rideData.ride_status !== 'canceled' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Settings className="size-4" />
                      Manage Ride
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      disabled={isLoading}
                      onClick={() => {
                        const bookedSeats = (rideData.total_seats || 0) - (rideData.available_seats || 0)
                        if (bookedSeats > 0) {
                          setShowEditWarn(true)
                        } else {
                          openPopup('Edit ride', <EditRidePopup ride={{ ...rideData, id: rideId }} onSaved={fetchRide} />)
                        }
                      }}
                    >
                      Edit ride <Pencil className="size-4 ml-1" />
                    </Button>
                    <Button variant="destructive" onClick={handleCancelRide} disabled={isLoading}>
                      Cancel ride <X className="size-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              )}

              <AlertDialog open={showEditWarn} onOpenChange={setShowEditWarn}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Riders have booked this ride</AlertDialogTitle>
                    <AlertDialogDescription>
                      {(() => {
                        const booked = (rideData?.total_seats || 0) - (rideData?.available_seats || 0)
                        return `${booked} seat${booked !== 1 ? 's have' : ' has'} already been booked with the current details. If you continue, riders will receive an email about the changes — but you should also contact them directly to confirm.`
                      })()}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => {
                      setShowEditWarn(false)
                      openPopup('Edit ride', <EditRidePopup ride={{ ...rideData, id: rideId }} onSaved={fetchRide} />)
                    }}>
                      Continue anyway
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>


              

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
                      <>
                      <div className="border rounded-md p-3 bg-secondary/30">
                        <p className="text-sm">
                          <strong>Seats:</strong> {currentBooking.booked_seats || 1}
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
                      <Link
                        href="/dashboard/bookings"
                        className="inline-flex items-center justify-center w-full text-sm font-medium rounded-md border border-border px-3 py-2 hover:bg-accent transition-colors"
                      >
                        View My Booked Rides
                      </Link>
                      </>
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

      <AlertDialog open={showDayConflict} onOpenChange={setShowDayConflict}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ride already booked that day</AlertDialogTitle>
            <AlertDialogDescription>
              You already have a booked ride on {rideData?.departure_date}. Only one ride per day is allowed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowDayConflict(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </DashboardLayout>
  );
}
