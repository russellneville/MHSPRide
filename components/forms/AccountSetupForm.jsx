import { Label } from "@/components/ui/label";
import { Input } from "../ui/input";
import { PASSWORD_REQUIREMENT_TEXT } from "@/lib/passwordPolicy";

export default function AccountSetupForm({ setRegisterForm, registerForm, errors }) {
  const handleChange = (e) => {
    setRegisterForm((prev) => ({ ...prev, [e.target.id]: e.target.value }))
  }

  return <>
    <div className="space-y-2">
      <Label htmlFor="email">Email address</Label>
      <Input id="email" type="email" placeholder="you@example.com" onChange={handleChange} value={registerForm.email} />
      {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
    </div>

    <div className="space-y-2">
      <Label htmlFor="password">Password</Label>
      <Input id="password" type="password" placeholder="*********" onChange={handleChange} value={registerForm.password} />
      {errors.password
        ? <p className="text-red-500 text-sm">{errors.password}</p>
        : <p className="text-muted-foreground text-sm">{PASSWORD_REQUIREMENT_TEXT}</p>}
    </div>

    <div className="space-y-2">
      <Label htmlFor="confirmpassword">Confirm Password</Label>
      <Input id="confirmpassword" type="password" placeholder="*********" onChange={handleChange} value={registerForm.confirmpassword} />
      {errors.confirmpassword && <p className="text-red-500 text-sm">{errors.confirmpassword}</p>}
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
  </>
}
