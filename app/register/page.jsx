'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import RegisterMemberForm from "@/components/forms/RegisterMemberForm";
import VerifyCodeForm from "@/components/forms/VerifyCodeForm";
import AccountSetupForm from "@/components/forms/AccountSetupForm";
import { useAuth } from "@/context/AuthContext";

const STEP_LABELS = {
  1: "Verify your MHSP membership",
  2: "Enter your verification code",
  3: "Set up your account",
  4: "Terms of use",
}

export default function Register() {
  const [currStep, setCurrStep] = useState(1)
  const [registerForm, setRegisterForm] = useState({
    fullname: '',
    lastName: '',
    mhspNumber: '',
    troopiterEmail: '',
    birthdate: '',
    email: '',
    password: '',
    confirmpassword: '',
    phone: '',
  })
  const [validationError, setValidationErrors] = useState({})
  const [verificationToken, setVerificationToken] = useState(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const { verifyMembership, verifyRegistrationCode, completeRegistration, isLoading } = useAuth()

  const validateStep1 = () => {
    const newErrors = {}
    if (!registerForm.mhspNumber.trim()) newErrors.mhspNumber = "MHSP member number is required"
    if (!registerForm.lastName.trim()) newErrors.lastName = "Last name is required"
    if (!registerForm.troopiterEmail.trim()) newErrors.troopiterEmail = "Troopiter email is required"
    else if (!/^\S+@\S+\.\S+$/.test(registerForm.troopiterEmail)) newErrors.troopiterEmail = "Invalid email address"

    setValidationErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep3 = () => {
    const newErrors = {}

    if (!registerForm.email.trim()) newErrors.email = "Email is required"
    else if (!/^\S+@\S+\.\S+$/.test(registerForm.email)) newErrors.email = "Invalid email address"
    if (!registerForm.password.trim()) newErrors.password = "Password is required"
    else if (registerForm.password.length < 8)
      newErrors.password = "Password must be at least 8 characters"
    else if (registerForm.password !== registerForm.confirmpassword)
      newErrors.confirmpassword = "Passwords do not match"

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

    setValidationErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const resetToStart = () => {
    setVerificationToken(null)
    setCode('')
    setCodeError('')
    setCurrStep(1)
  }

  const handleStep1Next = async () => {
    if (!validateStep1()) return
    const result = await verifyMembership({
      mhspNumber: registerForm.mhspNumber,
      lastName: registerForm.lastName,
      troopiterEmail: registerForm.troopiterEmail,
    })
    if (result.ok) {
      setVerificationToken(result.token)
      setRegisterForm(prev => ({ ...prev, email: prev.email || prev.troopiterEmail }))
      setCode('')
      setCodeError('')
      setCurrStep(2)
    }
  }

  const handleStep2Next = async () => {
    if (!code.trim()) {
      setCodeError('Enter the code sent to your email')
      return
    }
    const result = await verifyRegistrationCode({ token: verificationToken, code })
    if (result.ok) {
      setCodeError('')
      setCurrStep(3)
    } else if (result.locked || result.expired) {
      resetToStart()
    } else {
      setCodeError(result.error || 'Incorrect code.')
    }
  }

  const handleStep3Next = () => {
    if (validateStep3()) setCurrStep(4)
  }

  const handlePrevStep = () => {
    if (currStep === 2) {
      resetToStart()
    } else {
      setCurrStep(s => s - 1)
    }
  }

  const handleAcceptTerms = () => {
    completeRegistration({
      token: verificationToken,
      email: registerForm.email,
      password: registerForm.password,
      fullname: registerForm.fullname,
      phone: registerForm.phone,
      birthdate: registerForm.birthdate,
    }).then(result => {
      if (result.expired) resetToStart()
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 md:px-16 lg:px-20 py-10">
      <Card className="w-full max-w-md shadow-lg border border-border">
        <CardHeader className="flex flex-col items-center gap-3 text-center">
          <div className="flex justify-center">
            <Image src="/assets/mhsp_title_logo.png" alt="MHSPRide" height={40} width={130} />
          </div>
          <CardTitle className="text-2xl font-semibold">Create Account</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {`Step ${currStep} of 4 — ${STEP_LABELS[currStep]}`}
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

          {currStep === 2 && (
            <VerifyCodeForm
              code={code}
              setCode={setCode}
              error={codeError}
              onStartOver={resetToStart}
            />
          )}

          {currStep === 3 && (
            <AccountSetupForm
              setRegisterForm={setRegisterForm}
              registerForm={registerForm}
              errors={validationError}
            />
          )}

          {currStep < 4 && (
            <div className="flex items-center gap-4">
              <Button variant="outline" disabled={currStep === 1} onClick={handlePrevStep} className="flex-1">Previous</Button>
              <Button
                disabled={isLoading}
                className="flex-1"
                onClick={currStep === 1 ? handleStep1Next : currStep === 2 ? handleStep2Next : handleStep3Next}
              >
                {isLoading ? 'Please wait...' : 'Next'}
              </Button>
            </div>
          )}

          {currStep === 4 && (
            <>
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-4 max-h-72 overflow-y-auto text-sm text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground text-base">MHSPRide Terms of Use</p>

                <div className="space-y-1">
                  <p className="font-medium text-foreground">1. Use at Your Own Risk</p>
                  <p>MHSPRide is a voluntary carpooling coordination tool. Your use of this site and any rides arranged through it are entirely at your own risk.</p>
                </div>

                <div className="space-y-1">
                  <p className="font-medium text-foreground">2. Verify Who You're Riding With</p>
                  <p>MHSP is a community of trusted, committed volunteers. Even so, always use common sense before getting in a car with someone. Cross-reference members using your Troopiter roster or other MHSP channels before booking or accepting a ride from someone you don't recognize.</p>
                </div>

                <div className="space-y-1">
                  <p className="font-medium text-foreground">3. See Something, Say Something</p>
                  <p>If you experience or witness any behavior on this platform that feels unsafe, inappropriate, or unwanted, please report it through the feedback tool or directly to MHSP leadership. We take all reports seriously.</p>
                </div>

                <div className="space-y-1">
                  <p className="font-medium text-foreground">4. Emergencies</p>
                  <p>If you are ever in a dangerous situation or witness an emergency, call 911 immediately. Do not rely on this app or its administrators to respond to safety emergencies.</p>
                </div>

                <div className="space-y-1">
                  <p className="font-medium text-foreground">5. No Liability</p>
                  <p>The developers, administrators, and operators of MHSPRide expressly disclaim any and all liability arising from the use of this website or any ridesharing arrangements made through it. This includes, but is not limited to, personal injury, property damage, loss, or any other harm — whether direct, indirect, or incidental — resulting from rides coordinated here.</p>
                </div>

                <div className="space-y-1">
                  <p className="font-medium text-foreground">6. Your Responsibility</p>
                  <p>By creating an account, you acknowledge that you are a willing participant in a voluntary, community-based carpooling service. You accept full and sole responsibility for your own safety, the safety of anyone you invite into your vehicle, and any decisions you make as a driver or passenger. You agree not to hold the site, its developers, or any other users legally responsible for any outcome.</p>
                </div>

                <div className="space-y-1">
                  <p className="font-medium text-foreground">7. No Guarantees</p>
                  <p>MHSPRide makes no guarantee of the accuracy, availability, or reliability of information posted on this site. Ride details, driver information, and availability can change at any time. Always confirm directly with your driver or passenger before heading out.</p>
                </div>

                <div className="space-y-1">
                  <p className="font-medium text-foreground">8. Changes to These Terms</p>
                  <p>These terms may be updated at any time without prior notice. Continued use of the site after changes are posted constitutes acceptance of the revised terms.</p>
                </div>

                <p className="text-xs text-muted-foreground pt-2 border-t border-border">Last updated: March 2026</p>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setCurrStep(3)}>
                  Back
                </Button>
                <Button
                  disabled={isLoading}
                  className="flex-1"
                  onClick={handleAcceptTerms}
                >
                  {isLoading ? 'Creating account...' : 'Accept & Create Account'}
                </Button>
              </div>
            </>
          )}
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
