'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import Link from "next/link";
import { Select , SelectGroup, SelectTrigger , SelectContent, SelectItem, SelectLabel, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import RegisterDirectorRole from "@/components/forms/RegisterDirectorRole";
import RegisterDriverRole from "@/components/forms/RegisterDriverRole";
import RegisterPassengerRole from "@/components/forms/RegisterPassengerRole";
import { useAuth } from "@/context/AuthContext";

export default function Register() {

  const roles = ['director' , 'passenger' , 'driver']
  const [ currRole , setCurrRole] = useState('')
  const [ currStep , setCurrStep] = useState(1)
  const [ registerForm , setRegisterForm ] = useState({
    fullname : '', 
    birthdate : '' , 
    email : ''  , 
    password : '' , 
    confirmpassword : '' ,
    phone : '' ,
    roleform : {}
  })
  const [validationError , setValidationErrors] = useState({})
  

  const { registerUser , isLoading } = useAuth()

  const validateForm = (e)=>{
    const newErrors = {}
    if (currStep == 1){
      if (!currRole) newErrors.role = "role is required"
      if (!registerForm.fullname.trim()) newErrors.fullname = "full name is required"
      if (!registerForm.phone.trim()) newErrors.phone = "Phone number is required"
      if (!registerForm.birthdate.trim()) {
        newErrors.birthdate = "Birthdate is required";
      } else {
        const today = new Date();
        const birthDate = new Date(registerForm.birthdate);
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const dayDiff = today.getDate() - birthDate.getDate();

        const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

        if (actualAge < 18) {
          newErrors.birthdate = "You must be at least 18 years old";
        }
      }

      if (currRole === 'director') {
        const institution = registerForm.roleform?.institution || '';
        if (!institution.trim()) newErrors.institution = "institution is required";
      }
      else if (currRole === 'driver') {
        const carModel = registerForm.roleform?.carModel || '';
        const licencePlate = registerForm.roleform?.licencePlate || '';
        if (!carModel.trim()) newErrors.carModel = "car model is required";
        if (!licencePlate.trim()) newErrors.licencePlate = "licence plate is required";
      }
    }
    


    else {
      if (!registerForm.email.trim()) newErrors.email = "Email is required";
      else if (!/^\S+@\S+\.\S+$/.test(registerForm.email)) newErrors.email = "Invalid email address";
  
      if (!registerForm.password.trim()) newErrors.password = "Password is required";
      else if (registerForm.password.length < 6 || registerForm.password.length > 15) newErrors.password = "Password length must be between 6 and 15";
  
      else if (registerForm.password !== registerForm.confirmpassword){
        newErrors.confirmpassword = "Passwords do not matches";
      }
    }

    


    

    setValidationErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  const handleChange = (e)=>{
    setRegisterForm(prev => ({...prev , [e.target.id] : e.target.value}))
  }



  const handleNextStep = ()=>{
    if (validateForm()){
      if (currStep === 2) {
        registerUser(registerForm)
      }
    else {
      setCurrStep(s => s + 1)
    }
    }
  }

  const handlePrevStep = ()=>{
    setCurrStep(s => s - 1)
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-6 md:px-16 lg:px-20 py-10">
      <Card className="w-full max-w-md shadow-lg border border-border">
        <CardHeader className="flex flex-col items-center gap-3 text-center">
          <div className="flex justify-center">
            <Image
              className="dark:hidden"
              src="/assets/mhsp_title_logo.png"
              alt="logo"
              height={40}
              width={130}
            />
            <Image
              className="hidden dark:block"
              src="/assets/mhsp_title_logo.png"
              alt="logo"
              height={40}
              width={130}
            />
          </div>
          <CardTitle className="text-2xl font-semibold">Create Account</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
              Step {currStep} of 2 . Let's get started!
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {currStep == 1 && <>
            <div className="space-y-2">
              <Label htmlFor="select-role">Select role</Label>
              <Select id='select-role' className='w-full' value={currRole} 
              onValueChange={(value)=>{
                setCurrRole(value);
                setRegisterForm((prev) => ({
                  ...prev,
                  roleform: {}, 
                }));
              }}>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Roles</SelectLabel>
                    {roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {validationError.role && <p className="text-red-500 text-sm">{validationError.role}</p>}
            </div>
            {currRole == 'director' ? 
              <RegisterDirectorRole
                setRegisterForm={setRegisterForm} 
                registerForm={registerForm} 
                errors={validationError}
                currRole={currRole}/> 
                                            
            : currRole == 'driver' ?  
                <RegisterDriverRole 
                  setRegisterForm={setRegisterForm} 
                  registerForm={registerForm} 
                  errors={validationError}
                  currRole={currRole}/> 
                : currRole == 'passenger' &&
                  <RegisterPassengerRole 
                    setRegisterForm={setRegisterForm} 
                    registerForm={registerForm} 
                    errors={validationError}
                    currRole={currRole}/>}
            
          </>}

          {currStep == 2 && <>
            

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" placeholder="you@example.com" onChange={handleChange} value={registerForm.email}/>
              {validationError.email && <p className="text-red-500 text-sm">{validationError.email}</p>}
            </div>
  
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="*********" onChange={handleChange} value={registerForm.password}/>
              {validationError.password && <p className="text-red-500 text-sm">{validationError.password}</p>}
            </div>
  
            <div className="space-y-2">
              <Label htmlFor="confirmpassword">Confirm Password</Label>
              <Input id="confirmpassword" type="password" placeholder="*********" onChange={handleChange} value={registerForm.confirmpassword}/>
              {validationError.confirmpassword && <p className="text-red-500 text-sm">{validationError.confirmpassword}</p>}
            </div>
            </>}


          <div className="flex items-center gap-4">
            <Button variant='outline' disabled={currStep == 1} onClick={handlePrevStep} className='flex-1'> Previous</Button>
            <Button disabled={isLoading} className={`flex-1 ${isLoading ? 'opacity-75' : 'opacity-100'}`} onClick={handleNextStep}> {currStep === 2 ? 
                                                                        isLoading ? 'Registring... ' : 
                                                                        'Register' :
                                                                   'Next'} </Button>
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
  );
}
