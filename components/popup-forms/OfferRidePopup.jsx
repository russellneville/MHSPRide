import { useState } from "react"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import DatePicker from "../ui/date-picker"
import { usePopup } from "@/context/PopupContext"
import { useNetwork } from "@/context/NetworksContext"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"

export default function OfferRidePopup({networkId}){
    const [rideData , setRideData] = useState({
        departure : '' ,
        arrival : '' ,
        ride_description : '',
        departure_date : '' , 
        departure_time : '' ,
        arrival_date : '' , 
        arrival_time : '' ,
        total_seats : 0
    })
    const [departureDate , setDepartureDate] = useState(undefined)
    const [arrivalDate , setArrivalDate] = useState(undefined)
    const [validationError , setValidationErrors] = useState({})
    const { closePopup } = usePopup()
    const { isLoading , offerRide } = useNetwork()

     const validateForm = () => {
        const newErrors = {}
        if (!rideData.departure.trim()) newErrors.departure = "Ride departure is required"
        if (!rideData.arrival.trim()) newErrors.arrival = "Ride arrival is required"
        if (!rideData.ride_description.trim()) newErrors.ride_description = "Ride description is required"
        if (!rideData.departure_date) newErrors.departure_date = "Ride departure date is required"
        if (!rideData.departure_time) newErrors.departure_time = "Ride departure time is required"
        if (!rideData.total_seats || rideData.total_seats < 1) newErrors.total_seats = "Ride available seats is required"
        setValidationErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }


    const handleChange = (e)=>{
        setRideData(prev => ({...prev , [e.target.id] : e.target.value.toLowerCase()}))
    }
    

    const handleDepartureDateChange = (selectedDate) => {
        setDepartureDate(selectedDate);
        setRideData((prev) => ({
          ...prev,
          departure_date: selectedDate ? selectedDate.toLocaleDateString("en-CA") : "",
        }));
    };

    const handleArrivalDateChange = (selectedDate) => {
        setArrivalDate(selectedDate);
        setRideData((prev) => ({
          ...prev,
          arrival_date: selectedDate ? selectedDate.toLocaleDateString("en-CA") : "",
        }));
    };

    const handleOfferRide = async ()=>{
         if (validateForm()){
            await offerRide(rideData , networkId)
            closePopup()
         }
        
    }
    return <div className="space-y-4">
            <div className="space-y-2 flex items-center gap-2 w-full">
                <div className="w-full mb-0 space-y-2">
                    <Label htmlFor="departure">Departure</Label>
                    <Input id="departure" type="text" placeholder='Departure location' onChange={handleChange} value={rideData.departure}/>
                    {validationError.departure && <p className="text-red-500 text-sm">{validationError.departure}</p>}
                </div>
                <div className="w-full space-y-2">
                    <Label htmlFor="arrival">Arrival</Label>
                    <Input id="arrival" type="text" placeholder="Arrival location" onChange={handleChange} value={rideData.arrival}/>
                    {validationError.arrival && <p className="text-red-500 text-sm">{validationError.arrival}</p>}
                </div>
            </div>

            <div className="space-y-2 flex items-center gap-2 w-full">
                <div className="w-full mb-0 space-y-2">
                    <Label htmlFor='departure_date'>Departure Date</Label>
                    <DatePicker
                      id="departure_date"
                      date={rideData.departure_date ? new Date(rideData.departure_date) : undefined}
                      setDate={handleDepartureDateChange}
                      disabled={{
                        before: new Date(), 
                    }}
                    />
                    {validationError.departure_date && <p className="text-red-500 text-sm">{validationError.departure_date}</p>}
                </div>
                <div className="w-full mb-0 space-y-2">
                    <Label htmlFor='departure_time'>Departure time</Label>
                    <Input type='time' id='departure_time' onChange={handleChange} value={rideData.departure_time}></Input>
                    {validationError.departure_time && <p className="text-red-500 text-sm">{validationError.departure_time}</p>}
                </div>
            </div>

            <div className="space-y-2 flex items-center gap-2 w-full">
                <div className="w-full mb-0 space-y-2">
                    <Label htmlFor='arrival_date'>Arrival Date</Label>
                    <DatePicker
                      id="arrival_date"
                      date={rideData.arrival_date ? new Date(rideData.arrival_date) : undefined}
                      setDate={handleArrivalDateChange}
                       disabled={{
                            before: new Date(), 
                        }}
                    />
                    {validationError.arrival_date && <p className="text-red-500 text-sm">{validationError.arrival_date}</p>}
                </div>
                <div className="w-full mb-0 space-y-2">
                    <Label htmlFor='arrival_time'>Arrival time</Label>
                    <Input type='time' id='arrival_time' onChange={handleChange} value={rideData.arrival_time}></Input>
                    {validationError.arrival_time && <p className="text-red-500 text-sm">{validationError.arrival_time}</p>}
                </div>
            </div>

            <div className="space-y-2 w-full">
                <div className="w-full mb-0 space-y-2">
                    <Label htmlFor='total_seats'>Number of seats</Label>
                    <Input type='number' id='total_seats' placeholder='0' onChange={handleChange} value={rideData.total_seats}></Input>
                    {validationError.total_seats && <p className="text-red-500 text-sm">{validationError.total_seats}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor='ride_description'>Ride description</Label>
                <Textarea placeholder='Describe your ride' id='ride_description' className='resize-none h-45' onChange={handleChange} value={rideData.ride_description}></Textarea>
                {validationError.ride_description && <p className="text-red-500 text-sm">{validationError.ride_description}</p>}
            </div>


            <div className="flex justify-end gap-4">
                <Button onClick={closePopup} variant='outline'>Cancel</Button>
                <Button onClick={handleOfferRide} disabled={isLoading}>{isLoading ? 'Submitting...' : 'Submit ride'}</Button>
            </div>
            
    </div>
} 