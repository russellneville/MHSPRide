'use client'
import { useEffect, useState } from "react";
import DashboardLayout from "../../dashboardLayout";
import { useParams } from "next/navigation";
import { useNetwork } from "@/context/NetworksContext";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QRCodeCanvas } from "qrcode.react";
import { useAuth } from "@/context/AuthContext";

export default function BookingPage() {
  const { bookingId } = useParams();
  const { getBooking } = useNetwork();
  const [bookingData, setBookingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth()

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        setLoading(true);
        const data = await getBooking(bookingId);
        setBookingData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (bookingId) fetchBooking();
  }, [user , bookingId]);

  if (loading) {
    return (
      <DashboardLayout>
        <p className="text-center py-10 text-muted-foreground">Loading booking...</p>
      </DashboardLayout>
    );
  }

  if (!bookingData) {
    return (
      <DashboardLayout>
        <p className="text-center py-10 text-red-500">Booking not found!</p>
      </DashboardLayout>
    );
  }

  const bookingUrl = `${window.location.origin}/dashboard/bookings/${bookingId}`;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-2xl font-semibold">Booking Details</h2>
            <p className="text-sm text-muted-foreground">
              Booking ID: <span className="font-medium">{bookingId}</span>
            </p>
          </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <Card>
            <CardHeader>
              <CardTitle>Booking Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="font-medium">Booking ID:</span> {bookingData.id}</p>
              <p><span className="font-medium">Driver:</span> {bookingData.driver.fullname} ({bookingData.driver.email})</p>
              <p><span className="font-medium">Phone:</span> {bookingData.driver.phone}</p>
              <p><span className="font-medium">Ride:</span> {bookingData.departure} → {bookingData.arrival}</p>
              <p><span className="font-medium">Seats Booked:</span> {bookingData.booked_seats}</p>
              <p><span className="font-medium">Booking Status:</span> <Badge variant={bookingData.booking_status}>{bookingData.booking_status}</Badge></p>
              <p><span className="font-medium">Booked At:</span> {new Date(bookingData.booked_at?.seconds * 1000).toLocaleString()}</p>
            </CardContent>
          </Card>

          
          <Card className="flex flex-col items-center justify-center">
            <CardHeader>
              <CardTitle>QR Code</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <QRCodeCanvas value={bookingUrl} size={200} />
              <p className="text-sm text-muted-foreground text-center">Scan this QR code to view your booking</p>
            </CardContent>
          </Card>
        </div>
      
    </DashboardLayout>
  );
}
