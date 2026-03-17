import { Label } from "@/components/ui/label";
import { Input } from "../ui/input";
import DatePicker from "../ui/date-picker";

export default function RegisterMemberForm({ setRegisterForm, registerForm, errors }) {
  const handleChange = (e) => {
    setRegisterForm((prev) => ({ ...prev, [e.target.id]: e.target.value }))
  }

  const handleDateChange = (selectedDate) => {
    setRegisterForm((prev) => ({
      ...prev,
      birthdate: selectedDate ? selectedDate.toLocaleDateString("en-CA") : "",
    }))
  }

  return <>
    <div className="space-y-2">
      <Label htmlFor="mhspNumber">MHSP Member Number</Label>
      <Input id="mhspNumber" type="text" placeholder="e.g. 1636" onChange={handleChange} value={registerForm.mhspNumber} />
      {errors.mhspNumber && <p className="text-red-500 text-sm">{errors.mhspNumber}</p>}
    </div>

    <div className="space-y-2">
      <Label htmlFor="lastName">Last Name</Label>
      <Input id="lastName" type="text" placeholder="As it appears on your MHSP record" onChange={handleChange} value={registerForm.lastName} />
      {errors.lastName && <p className="text-red-500 text-sm">{errors.lastName}</p>}
    </div>

    <div className="space-y-2">
      <Label htmlFor="fullname">Full Name</Label>
      <Input id="fullname" type="text" placeholder="John Doe" onChange={handleChange} value={registerForm.fullname} />
      {errors.fullname && <p className="text-red-500 text-sm">{errors.fullname}</p>}
    </div>

    <div className="space-y-2">
      <Label htmlFor="phone">Phone Number</Label>
      <Input id="phone" type="tel" placeholder="503-555-0100" onChange={handleChange} value={registerForm.phone} />
      {errors.phone && <p className="text-red-500 text-sm">{errors.phone}</p>}
    </div>

    <div className="space-y-2">
      <Label htmlFor="birthdate">Date of Birth</Label>
      <DatePicker
        id="birthdate"
        date={registerForm.birthdate ? new Date(registerForm.birthdate + 'T12:00:00') : undefined}
        setDate={handleDateChange}
      />
      {errors.birthdate && <p className="text-red-500 text-sm">{errors.birthdate}</p>}
    </div>
  </>
}
