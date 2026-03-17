'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import RegisterMemberForm from "@/components/forms/RegisterMemberForm";
import { useAuth } from "@/context/AuthContext";

export default function Register() {
  const [currStep, setCurrStep] = useState(1)
  const [registerForm, setRegisterForm] = useState({
    fullname: '',
    lastName: '',
    mhspNumber: '',
    birthdate: '',
    email: '',
    password: '',
    confirmpassword: '',
    phone: '',
  })
  const [validationError, setValidationErrors] = useState({})
  const { registerUser, isLoading } = useAuth()

  const validateForm = () => {
    const newErrors = {}

    if (currStep === 1) {
      if (!registerForm.mhspNumber.trim()) newErrors.mhspNumber = "MHSP member number is required"
      if (!registerForm.lastName.trim()) newErrors.lastName = "Last name is required"
      if (!registerForm.fullname.trim()) newErrors.fullname = "Full name is required"
      if (!registerForm.phone.trim()) newErrors.phone = "Phone number is required"
      if (!registerForm.birthdate.trim()) {
        newErrors.birthdate = "Date of birth is required"
      } else {
        const today = new Date()
        const birthDate = new Date(registerForm.birthdate + 'T12:00:00')
        const age = today.getFullYear() - birthDate.getFullYear()
        const monthDiff = today.getMonth() - birthDate.getMonth()
        const dayDiff = today.getDate() - birthDate.getDate()
        const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age
        if (actualAge < 18) newErrors.birthdate = "You must be at least 18 years old"
      }
    } else {
      if (!registerForm.email.trim()) newErrors.email = "Email is required"
      else if (!/^\S+@\S+\.\S+$/.test(registerForm.email)) newErrors.email = "Invalid email address"
      if (!registerForm.password.trim()) newErrors.password = "Password is required"
      else if (registerForm.password.length < 6 || registerForm.password.length > 15)
        newErrors.password = "Password must be between 6 and 15 characters"
      else if (registerForm.password !== registerForm.confirmpassword)
        newErrors.confirmpassword = "Passwords do not match"
    }

    setValidationErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e) => {
    setRegisterForm(prev => ({ ...prev, [e.target.id]: e.target.value }))
  }

  const handleNextStep = () => {
    if (validateForm()) {
      if (currStep === 2) {
        registerUser(registerForm)
      } else {
        setCurrStep(s => s + 1)
      }
    }
  }

  const handlePrevStep = () => setCurrStep(s => s - 1)

  return (
    <div className="min-h-screen flex items-center justify-center px-6 md:px-16 lg:px-20 py-10">
      <Card className="w-full max-w-md shadow-lg border border-border">
        <CardHeader className="flex flex-col items-center gap-3 text-center">
          <div className="flex justify-center">
            <Image src="/assets/mhsp_title_logo.png" alt="MHSPRide" height={40} width={130} />
          </div>
          <CardTitle className="text-2xl font-semibold">Create Account</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Step {currStep} of 2 — {currStep === 1 ? "Verify your MHSP membership" : "Set up your login"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {currStep === 1 && (
            <RegisterMemberForm
              setRegisterForm={setRegisterForm}
              registerForm={registerForm}
              errors={validationError}
            />
          )}

          {currStep === 2 && <>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" placeholder="you@example.com" onChange={handleChange} value={registerForm.email} />
              {validationError.email && <p className="text-red-500 text-sm">{validationError.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="*********" onChange={handleChange} value={registerForm.password} />
              {validationError.password && <p className="text-red-500 text-sm">{validationError.password}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmpassword">Confirm Password</Label>
              <Input id="confirmpassword" type="password" placeholder="*********" onChange={handleChange} value={registerForm.confirmpassword} />
              {validationError.confirmpassword && <p className="text-red-500 text-sm">{validationError.confirmpassword}</p>}
            </div>
          </>}

          <div className="flex items-center gap-4">
            <Button variant="outline" disabled={currStep === 1} onClick={handlePrevStep} className="flex-1">Previous</Button>
            <Button disabled={isLoading} className={`flex-1 ${isLoading ? 'opacity-75' : ''}`} onClick={handleNextStep}>
              {currStep === 2 ? (isLoading ? 'Creating account...' : 'Register') : 'Next'}
            </Button>
          </div>
        </CardContent>

        <CardFooter className="text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 block text-center hover:underline dark:text-blue-400">
            Log in
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
