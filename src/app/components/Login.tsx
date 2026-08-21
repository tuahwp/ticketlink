"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { validateRegistrationCode } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [codeValidation, setCodeValidation] = useState<{
    isValid: boolean;
    message: string;
    partnerName?: string;
    role?: "AGENT" | "FIELD_ENGINEER";
  } | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);

  const [isSignUp, setIsSignUp] = useState(false);
  const [isInvited, setIsInvited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleValidateCode = async (code: string) => {
    if (!code.trim()) {
      setCodeValidation(null);
      return;
    }
    setIsValidatingCode(true);
    try {
      const res = await validateRegistrationCode(code);
      if (res.valid) {
        setCodeValidation({
          isValid: true,
          message: `✓ Valid Code: Joining "${res.partnerName}" as ${res.role === "FIELD_ENGINEER" ? "Field Engineer" : "Agent"}`,
          partnerName: res.partnerName,
          role: res.role,
        });
      }
    } catch (err: any) {
      setCodeValidation({
        isValid: false,
        message: err.message || "Invalid registration code.",
      });
    } finally {
      setIsValidatingCode(false);
    }
  };

  useEffect(() => {
    if (!registrationCode.trim()) {
      setCodeValidation(null);
      return;
    }
    const timer = setTimeout(() => {
      handleValidateCode(registrationCode);
    }, 500);
    return () => clearTimeout(timer);
  }, [registrationCode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      const nameParam = params.get("name");
      const modeParam = params.get("mode");
      const codeParam = params.get("code");

      if (emailParam) {
        setEmail(emailParam);
        setIsInvited(true);
      }
      if (nameParam) {
        setName(nameParam);
      }
      if (modeParam === "signup") {
        setIsSignUp(true);
      } else if (modeParam === "reset_password") {
        setIsResetPassword(true);
      }
      if (codeParam) {
        setRegistrationCode(codeParam);
        setIsSignUp(true);
        handleValidateCode(codeParam);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isResetPassword) {
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        const { error: updateError } = await supabase.auth.updateUser({
          password,
        });
        if (updateError) throw updateError;
        const msg = "Password updated successfully! Redirecting...";
        setMessage(msg);
        toast.success(msg);
        setTimeout(() => {
          window.location.href = "/";
        }, 1500);
      } else if (isForgotPassword) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login?mode=reset_password`,
        });
        if (resetError) throw resetError;
        const msg = "Password reset link has been sent to your email.";
        setMessage(msg);
        toast.success(msg);
      } else if (isSignUp) {
        if (registrationCode.trim() && codeValidation && !codeValidation.isValid) {
          throw new Error(codeValidation.message);
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name || undefined,
              phone: phone || undefined,
              registration_code: registrationCode.trim() || undefined,
            },
          },
        });
        if (signUpError) throw signUpError;
        const msg = "Registration successful! You can now log in.";
        setMessage(msg);
        toast.success(msg);
        setIsSignUp(false);
        setPhone("");
        setRegistrationCode("");
        setCodeValidation(null);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        toast.success("Welcome back! Signing you in...");
      }
    } catch (err: any) {
      const errMsg = err.message || "An unexpected error occurred";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground antialiased">
      {/* Left Column: Visual Cover Illustration (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-card border-r border-border">
        {/* Ambient top light */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        
        {/* Header logo / branding */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl overflow-hidden border border-border shadow-sm">
            <img src="/logo.jpg" alt="TicketLink Logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight">
            Ticket<span className="text-teal-600 dark:text-teal-400">Link</span>
          </span>
        </div>

        {/* Centerpiece: Illustration Mockup */}
        <div className="relative z-10 my-auto max-w-lg mx-auto">
          <div className="relative rounded-2xl overflow-hidden border border-border shadow-2xl bg-card p-2 transition-all duration-500 hover:border-primary/30">
            <img
              src="/login_cover.jpg"
              alt="Dashboard Cover Preview"
              className="w-full h-auto rounded-xl object-cover transition-transform duration-700 hover:scale-[1.01]"
            />
            <div className="absolute -bottom-4 -right-4 w-28 h-28 bg-primary/10 rounded-full blur-2xl transition-all" />
          </div>
          
          <div className="mt-8 text-left space-y-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground leading-tight tracking-tight">
              Enterprise Field Service <br />
              <span className="text-teal-600 dark:text-teal-400">Dispatch & SLA Platform</span>
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed font-medium">
              Seamlessly monitor active tickets, coordinate Field Engineers, upload verified service reports, and optimize client SLA response times in one dynamic workspace.
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-muted-foreground flex justify-between font-mono font-medium">
          <span>v2.5.0 — STABLE</span>
          <span>© 2026 TicketLink</span>
        </div>
      </div>

      {/* Right Column: Credentials Input Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative bg-background">
        <Card className="w-full max-w-md shadow-xl border-border">
          <CardHeader className="space-y-2 pb-6">
            {/* Mobile Header Branding */}
            <div className="flex lg:hidden flex-col items-center mb-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl overflow-hidden mb-2 border border-border shadow-sm">
                <img src="/logo.jpg" alt="TicketLink Logo" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                Ticket<span className="text-teal-600 dark:text-teal-400">Link</span>
              </h2>
            </div>

            <CardTitle className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {isResetPassword 
                ? "Reset Password" 
                : isForgotPassword 
                ? "Recover Password" 
                : isSignUp 
                ? "Register Account" 
                : "Access Workspace"}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {isResetPassword
                ? "Create a new strong password for your account"
                : isForgotPassword
                ? "Enter your email to receive a password reset link"
                : isSignUp 
                ? "Sign up to begin setting up your profiles and dispatches" 
                : "Sign in to view assignments or dispatch engineers"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Invitation welcome block */}
            {isInvited && isSignUp && (
              <Alert className="bg-primary/5 border-primary/20 text-primary">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <span className="font-bold block">FE Invitation Confirmed</span>
                  Your profile name and email have been prefilled. Set a password to activate your account.
                </AlertDescription>
              </Alert>
            )}

            {/* Error & Message Alerts */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs font-semibold">{error}</AlertDescription>
              </Alert>
            )}

            {message && (
              <Alert className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <AlertDescription className="text-xs font-semibold">{message}</AlertDescription>
              </Alert>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">
                      Full Name
                    </Label>
                    <Input
                      type="text"
                      required
                      disabled={isInvited}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ahmad Zaki"
                      className="text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">
                      Phone Number
                    </Label>
                    <Input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +6012-345 6789"
                      className="text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">
                      Registration Code (Optional)
                    </Label>
                    <Input
                      type="text"
                      value={registrationCode}
                      onChange={(e) => setRegistrationCode(e.target.value)}
                      placeholder="e.g. AB12CD34"
                      className="text-xs font-mono font-medium uppercase"
                    />
                    {isValidatingCode && (
                      <span className="text-[10px] text-primary mt-1 font-semibold flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Validating code...
                      </span>
                    )}
                    {codeValidation && (
                      <span className={`text-[10px] mt-1 font-bold block ${
                        codeValidation.isValid ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                      }`}>
                        {codeValidation.message}
                      </span>
                    )}
                  </div>
                </>
              )}

              {!isResetPassword && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">
                    Email Address
                  </Label>
                  <Input
                    type="email"
                    required
                    disabled={isInvited}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="text-xs font-medium"
                  />
                </div>
              )}

              {!isForgotPassword && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">
                      {isResetPassword ? "New Password" : "Password"}
                    </Label>
                    {!isSignUp && !isResetPassword && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setError(null);
                          setMessage(null);
                        }}
                        className="text-[11px] font-bold text-primary hover:underline"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <Input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="text-xs font-medium"
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white font-bold text-xs h-10 shadow-md"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isResetPassword ? (
                  "Save New Password"
                ) : isForgotPassword ? (
                  "Send Reset Link"
                ) : isSignUp ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Toggle button */}
            <div className="text-center pt-2">
              {isForgotPassword || isResetPassword ? (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setIsResetPassword(false);
                    setIsSignUp(false);
                    setError(null);
                    setMessage(null);
                  }}
                  className="text-xs font-semibold"
                >
                  Back to Sign In
                </Button>
              ) : (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                    setMessage(null);
                  }}
                  className="text-xs font-semibold"
                >
                  {isSignUp ? "Already have an account? Sign In" : "Need an account? Register here"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
