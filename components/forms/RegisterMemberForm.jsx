import { Label } from "@/components/ui/label";
import { Input } from "../ui/input";

export default function RegisterMemberForm({ setRegisterForm, registerForm, errors }) {
  const handleChange = (e) => {
    setRegisterForm((prev) => ({ ...prev, [e.target.id]: e.target.value }))
  }

  return <>
    <div className="space-y-2">
      <Label htmlFor="mhspNumber">MHSP Member Number</Label>
      <Input id="mhspNumber" type="text" placeholder="e.g. 1636" onChange={handleChange} value={registerForm.mhspNumber} />
      {errors.mhspNumber && <p className="text-red-500 text-sm">{errors.mhspNumber}</p>}
    </div>

    <div className="space-y-2">
      <Label htmlFor="lastName">Last Name</Label>
      <Input id="lastName" type="text" placeholder="As it appears in Troopiter" onChange={handleChange} value={registerForm.lastName} />
      {errors.lastName && <p className="text-red-500 text-sm">{errors.lastName}</p>}
    </div>

    <div className="space-y-2">
      <Label htmlFor="troopiterEmail">Troopiter Email</Label>
      <Input id="troopiterEmail" type="email" placeholder="As it appears in Troopiter" onChange={handleChange} value={registerForm.troopiterEmail} />
      {errors.troopiterEmail && <p className="text-red-500 text-sm">{errors.troopiterEmail}</p>}
      <p className="text-xs text-muted-foreground">A verification email will be sent to your Troopiter email address.</p>
    </div>
  </>
}
