'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext"; 
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [loginForm , setLoginForm] = useState({
    email : '',password : ''
  })
  const [mounted, setMounted] = useState(false);
  const [validationError , setValidationErrors] = useState({})
  const { isLoading , loginUser , user, resetPassword } = useAuth()
  const [forgotMode, setForgotMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const router = useRouter()
  const validateForm = ()=>{
    const newErrors = {}
    if (!loginForm.email.trim()) newErrors.email = "Email is required";
      else if (!/^\S+@\S+\.\S+$/.test(loginForm.email)) newErrors.email = "Invalid email address";
  
    if (!loginForm.password.trim()) newErrors.password = "Password is required";

    setValidationErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  const handleChange = e =>{
    setLoginForm(prev => ({...prev , [e.target.id] : e.target.value}))
  }

  const handleLogin = async ()=>{
    if (!validateForm()) return ;
    await loginUser(loginForm)
  }
  useEffect(() => setMounted(true), []);


  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  if (!mounted || isLoading && user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading session...
      </div>
    );
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
          <CardTitle className="text-2xl font-semibold">Welcome Back</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Log in to access your dashboard and stay updated.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" placeholder="you@example.com" onChange={handleChange} value={loginForm.email}/>
            {validationError.email && <p className="text-red-500 text-sm">{validationError.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="*********" onChange={handleChange} value={loginForm.password}/>
            {validationError.password && <p className="text-red-500 text-sm">{validationError.password}</p>}
          </div>

          {forgotMode ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Enter your email address and we'll send you a link to reset your password.</p>
              <Input
                type="email"
                placeholder="you@example.com"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
              />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => { resetPassword(resetEmail); setForgotMode(false); setResetEmail('') }} disabled={!resetEmail.trim()}>
                  Send Reset Link
                </Button>
                <Button variant="outline" onClick={() => { setForgotMode(false); setResetEmail('') }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => setForgotMode(true)} className="text-blue-600 hover:underline dark:text-blue-400">
                  Forgot password?
                </button>
              </div>
              <Button className={`w-full mt-2 ${isLoading ? 'opacity-75' : 'opacity-100'}`} onClick={handleLogin} disabled={isLoading}>{isLoading ? 'Logging in...' : 'Log In'}</Button>
            </>
          )}
        </CardContent>

        <CardFooter className="text-sm text-center text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/register" className="ml-1 text-blue-600 hover:underline dark:text-blue-400">
            Register
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
} 