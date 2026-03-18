import { Label } from "@/components/ui/label";
import { Input } from "../ui/input";
import DatePicker from "../ui/date-picker";
import { useState } from "react";
import { toLocalDateStr } from "@/lib/utils";

export default function RegisterDirectorRole({ setRegisterForm, registerForm , errors , currRole}) {
  const [date , setDate] = useState(undefined)
  const [roleData , setRoleData ] = useState({
    role : currRole , 
    institution : ''
  })

  
  const handleChange = (e) => {
    setRegisterForm((prev) => ({ ...prev, [e.target.id]: e.target.value , }));
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

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="fullname">Director Name</Label>
        <Input
          onChange={handleChange}
          id="fullname"
          type="text"
          placeholder="John Doe"
          value={registerForm.fullname}
        />
        {errors.fullname && <p className="text-red-500 text-sm">{errors.fullname}</p>}
      </div>

      <div className="space-y-2">
            <Label htmlFor="fullname">Phone number</Label>
            <Input id="phone" type="tel" placeholder="06XXXXXXXX" onChange={handleChange} value={registerForm.phone}/>
            {errors.phone && <p className="text-red-500 text-sm">{errors.phone}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthdate">Date of birth</Label>
        <DatePicker
          id="birthdate"
          date={registerForm.birthdate ? new Date(registerForm.birthdate + 'T12:00:00') : undefined}
          setDate={handleDateChange}
        />
        {errors.birthdate && <p className="text-red-500 text-sm">{errors.birthdate}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="institution">Institution name</Label>
        <Input
          onChange={AddRoleForm}
          id="institution"
          type="text"
          placeholder="Almolta9a"
          value={registerForm.roleform?.institution || ""}
        />
        {errors.institution && <p className="text-red-500 text-sm">{errors.institution}</p>}
      </div>
    </>
  );
}
