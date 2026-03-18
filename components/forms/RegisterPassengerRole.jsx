import { useState } from "react";
import DatePicker from "../ui/date-picker";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toLocalDateStr } from "@/lib/utils";

export default function RegisterPassengerRole ({ setRegisterForm, registerForm , errors , currRole}){
    const [date, setDate] = useState(undefined)
    const [ roleData , setRoleData ] = useState({ role: currRole , })

    const AddRoleForm = (e) => {
      const newRoleData = { ...roleData};
      setRoleData(newRoleData);
      setRegisterForm(prev => ({ ...prev, roleform: newRoleData }));
    };

    const handleChange = (e) => {
        AddRoleForm(e)
        setRegisterForm((prev) => ({ ...prev , [e.target.id]: e.target.value }));
    };
    
    const handleDateChange = (selectedDate) => {
        setDate(selectedDate);
        setRegisterForm((prev) => ({
          ...prev,
          birthdate: toLocalDateStr(selectedDate),
        }));
    };
    return <>
        <div className="space-y-2">
            <Label htmlFor="mhspNumber">MHSP Member Number</Label>
            <Input id="mhspNumber" type="text" placeholder="e.g. 1636" onChange={handleChange} value={registerForm.mhspNumber}/>
            {errors.mhspNumber && <p className="text-red-500 text-sm">{errors.mhspNumber}</p>}
        </div>

        <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input id="lastName" type="text" placeholder="Your last name as it appears on your MHSP record" onChange={handleChange} value={registerForm.lastName}/>
            {errors.lastName && <p className="text-red-500 text-sm">{errors.lastName}</p>}
        </div>

        <div className="space-y-2">
            <Label htmlFor="fullname">Full Name</Label>
            <Input id="fullname" type="text" placeholder="John Doe" onChange={handleChange} value={registerForm.fullname}/>
            {errors.fullname && <p className="text-red-500 text-sm">{errors.fullname}</p>}
        </div>

        <div className="space-y-2">
            <Label htmlFor="fullname">Phone number</Label>
            <Input id="phone" type="tel" placeholder="06XXXXXXXX" onChange={handleChange} value={registerForm.phone}/>
            {errors.phone && <p className="text-red-500 text-sm">{errors.phone}</p>}
        </div>

        <div className="space-y-2">
            <Label htmlFor='birthdate'>Date of birth</Label>
            <DatePicker
                id="birthdate"
                date={registerForm.birthdate ? new Date(registerForm.birthdate + 'T12:00:00') : undefined}
                setDate={handleDateChange}
            />
            {errors.birthdate && <p className="text-red-500 text-sm">{errors.birthdate}</p>}
        </div>
    </>
}