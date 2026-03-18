import { Label } from "@radix-ui/react-label";
import { Input } from "../ui/input";
import DatePicker from "../ui/date-picker";
import { useState } from "react";
import { toLocalDateStr } from "@/lib/utils";
export default function RegisterDriverRole ({ setRegisterForm, registerForm , errors , currRole}){
    const [date, setDate] = useState(undefined)
    const [roleData , setRoleData ] = useState({
      role : currRole , 
      carModel : '',
      licencePlate : '' , 
    })

    const handleChange = (e) => {
      setRegisterForm((prev) => ({ ...prev, [e.target.id]: e.target.value }));
    };
  
    const handleDateChange = (selectedDate) => {
      setDate(selectedDate);
      setRegisterForm((prev) => ({
        ...prev,
        birthdate: toLocalDateStr(selectedDate),
      }));
  };

    const AddRoleForm = (e) => {
      const newRoleData = { ...roleData, [e.target.id]: e.target.value };
      setRoleData(newRoleData);
      setRegisterForm(prev => ({ ...prev, roleform: newRoleData }));
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



    <div className="space-y-2">
      <Label htmlFor="carModel">Car Model</Label>
      <Input id="carModel" type="text" placeholder="Dacia Sandero" value={registerForm.roleform?.carModel || ""} onChange={AddRoleForm}/>
      {errors.carModel && <p className="text-red-500 text-sm">{errors.carModel}</p>}
    </div>

    <div className="space-y-2">
      <Label htmlFor="licencePlate">Licence Plate</Label>
      <Input id="licencePlate" type="text" placeholder="12345 - A - 25" onChange={AddRoleForm} value={registerForm.roleform?.licencePlate || ""}/>
      {errors.licencePlate && <p className="text-red-500 text-sm">{errors.licencePlate}</p>}
    </div>
</>
}