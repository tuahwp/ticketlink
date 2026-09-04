"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import {
  validateRegistrationCode,
  loginWithPasswordAction,
  registerWithCodeNativeAction,
  verifyEmailOtpAction,
  verifyEmailTokenAction,
  resendVerificationOtpAction,
  requestPasswordResetAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Loader2, Mail, ArrowLeft, RefreshCw, KeyRound } from "lucide-react";

interface LoginProps {
  onLoginSuccess?: (user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps = {}) {
  const { refreshProfile } = useAuth();
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

  // Email Verification OTP State
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);

  const [isSignUp, setIsSignUp] = useState(false);
  const [isInvited, setIsInvited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Resend Countdown Timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleValidateCode = async (code: string) => {
    if (!code.trim()) {
      setCodeValidation(null);
      return;
    }
    setIsValidatingCode(true);
    try {
      const res = await validateRegistrationCode(code);
      if (res && res.valid) {
        setCodeValidation({
          isValid: true,
          message: `✓ Valid Code: Joining "${res.partnerName}" as ${res.role === "FIELD_ENGINEER" ? "Field Engineer" : "Agent"}`,
          partnerName: res.partnerName,
          role: res.role,
        });
      } else {
        setCodeValidation({
          isValid: false,
          message: res?.message || "Invalid registration code.",
        });
      }
    } catch (err: any) {
      setCodeValidation({
        isValid: false,
        message: "Invalid registration code.",
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
      const verifyTokenParam = params.get("verifyToken");

      if (verifyTokenParam) {
        setIsVerifyingToken(true);
        verifyEmailTokenAction(verifyTokenParam)
          .then((res) => {
            if (res.success && res.user) {
              toast.success("Email verified successfully! Welcome to TicketLink.");
              if (onLoginSuccess) onLoginSuccess(res.user);
              refreshProfile();
            } else {
              setError(res.error || "Invalid or expired verification link.");
            }
          })
          .catch((err) => {
            setError(err.message || "Failed to verify token.");
          })
          .finally(() => {
            setIsVerifyingToken(false);
          });
      }

      if (emailParam) {
        setEmail(emailParam);
        setIsInvited(true);
      }
      if (nameParam) {
        setName(nameParam);
      }
      if (modeParam === "signup") {
        setIsSignUp(true);
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
      if (isVerifyingOtp) {
        // Handle OTP Submission
        if (!otpCode.trim() || otpCode.trim().length !== 6) {
          throw new Error("Please enter the 6-digit verification code.");
        }

        const res = await verifyEmailOtpAction({
          email: email.trim().toLowerCase(),
          otp: otpCode.trim(),
        });

        if (!res.success) {
          throw new Error(res.error);
        }

        toast.success("Email verified successfully! Welcome to TicketLink.");
        if (onLoginSuccess && res.user) {
          onLoginSuccess(res.user);
        }
        await refreshProfile();
        return;
      }

      if (isForgotPassword) {
        const res = await requestPasswordResetAction(email, window.location.origin);
        if (!res.success) {
          throw new Error(res.error);
        }
        const msg = "Password reset instructions have been sent to your email.";
        setMessage(msg);
        toast.success(msg);
      } else if (isSignUp) {
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        if (registrationCode.trim() && codeValidation && !codeValidation.isValid) {
          throw new Error(codeValidation.message);
        }

        const res = await registerWithCodeNativeAction({
          email,
          passwordPlain: password,
          name,
          phone,
          registrationCode: registrationCode.trim() || undefined,
          appOrigin: window.location.origin,
        });

        if (!res.success) {
          throw new Error(res.error);
        }

        if (res.requireEmailVerification) {
          setIsVerifyingOtp(true);
          setResendCooldown(60);
          const msg = res.message || `A verification code was sent to ${email}.`;
          setMessage(msg);
          toast.info(msg);
          return;
        }

        const msg = "Account created successfully! Signing you in...";
        setMessage(msg);
        toast.success(msg);
        if (onLoginSuccess && (res as any).user) {
          onLoginSuccess((res as any).user);
        }
        await refreshProfile();
      } else {
        // Native Sign In
        if (!password) {
          throw new Error("Please enter your password.");
        }

        const res = await loginWithPasswordAction(email, password);
        if (!res.success) {
          if (res.requireEmailVerification) {
            setIsVerifyingOtp(true);
            setResendCooldown(60);
            setMessage("Please verify your email address to complete sign in.");
            // Trigger automatic resend OTP
            await resendVerificationOtpAction(email, window.location.origin);
            return;
          }
          throw new Error(res.error);
        }

        if (res.firstTimeSetup) {
          toast.success("Welcome! Your account password has been set successfully.");
        } else {
          toast.success("Welcome back! Signing you in...");
        }

        if (onLoginSuccess && res.user) {
          onLoginSuccess(res.user);
        }

        await refreshProfile();
      }
    } catch (err: any) {
      const errMsg = err.message || "An unexpected error occurred";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const res = await resendVerificationOtpAction(email, window.location.origin);
      if (!res.success) throw new Error(res.error);
      setResendCooldown(60);
      toast.success(res.message || "Verification code resent.");
    } catch (err: any) {
      toast.error(err.message || "Failed to resend code.");
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
          <div className="flex items-center justify-center w-10 h-10 rounded-xl overflow-hidden border border-border shadow-xs">
            <img src="/logo.jpg" alt="TicketLink Logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight">
            Ticket<span className="text-indigo-600 dark:text-indigo-400">Link</span>
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
              Enterprise Field Engineering <br />
              <span className="text-indigo-600 dark:text-indigo-400">Dispatch & SLA Platform</span>
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
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl overflow-hidden mb-2 border border-border shadow-xs">
                <img src="/logo.jpg" alt="TicketLink Logo" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                Ticket<span className="text-indigo-600 dark:text-indigo-400">Link</span>
              </h2>
            </div>

            <CardTitle className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
              {isVerifyingOtp ? (
                <>
                  <Mail className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  Verify Your Email
                </>
              ) : isForgotPassword ? (
                "Recover Password"
              ) : isSignUp ? (
                "Register Account"
              ) : (
                "Access Workspace"
              )}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {isVerifyingOtp
                ? `Enter the 6-digit code sent to ${email}`
                : isForgotPassword
                ? "Enter your email to receive a password reset link"
                : isSignUp
                ? "Sign up to begin coordinating tickets and dispatches"
                : "Sign in to view assignments or dispatch engineers"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Loading token verification */}
            {isVerifyingToken && (
              <Alert className="bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription className="text-xs font-semibold">
                  Verifying your email token...
                </AlertDescription>
              </Alert>
            )}

            {/* Invitation welcome block */}
            {isInvited && isSignUp && !isVerifyingOtp && (
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
              {isVerifyingOtp ? (
                /* OTP Verification Screen */
                <div className="space-y-4 py-2">
                  <div className="space-y-2 text-center">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      6-Digit Verification Code
                    </Label>
                    <Input
                      type="text"
                      maxLength={6}
                      autoFocus
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="• • • • • •"
                      className="text-center font-mono font-extrabold text-2xl tracking-[0.5em] h-14 bg-muted/30 border-2 focus:border-indigo-600"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Check your inbox or spam folder for your activation code.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 shadow-md"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Activate Account"}
                  </Button>

                  <div className="flex items-center justify-between text-xs pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsVerifyingOtp(false);
                        setError(null);
                      }}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back
                    </button>

                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={loading || resendCooldown > 0}
                      className={`font-bold flex items-center gap-1 cursor-pointer ${
                        resendCooldown > 0 ? "text-muted-foreground cursor-not-allowed" : "text-indigo-600 dark:text-indigo-400 hover:underline"
                      }`}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                    </button>
                  </div>
                </div>
              ) : (
                /* Regular Sign-In / Sign-Up / Forgot-Password Form */
                <>
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
                          placeholder="e.g. Ahmad Razif"
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
                          placeholder="e.g. +60 12-345 6789"
                          className="text-xs font-medium"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase">
                          Team Join Code (Optional)
                        </Label>
                        <Input
                          type="text"
                          value={registrationCode}
                          onChange={(e) => setRegistrationCode(e.target.value)}
                          placeholder="e.g. TM-FE-8899"
                          className="text-xs font-mono font-medium uppercase"
                        />
                        {isValidatingCode && (
                          <span className="text-[10px] text-primary mt-1 font-semibold flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Validating code...
                          </span>
                        )}
                        {codeValidation && (
                          <span
                            className={`text-[10px] mt-1 font-bold block ${
                              codeValidation.isValid
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-destructive"
                            }`}
                          >
                            {codeValidation.message}
                          </span>
                        )}
                      </div>
                    </>
                  )}

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

                  {!isForgotPassword && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase">
                          Password
                        </Label>
                        {!isSignUp && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsForgotPassword(true);
                              setError(null);
                              setMessage(null);
                            }}
                            className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
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
                    className="w-full bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white font-bold text-xs h-10 shadow-md"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isForgotPassword ? (
                      "Send Reset Link"
                    ) : isSignUp ? (
                      "Create Account & Verify"
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </>
              )}
            </form>

            {/* Toggle button */}
            {!isVerifyingOtp && (
              <div className="text-center pt-2">
                {isForgotPassword ? (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setIsSignUp(false);
                      setError(null);
                      setMessage(null);
                    }}
                    className="text-xs font-semibold cursor-pointer"
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
                    className="text-xs font-semibold cursor-pointer"
                  >
                    {isSignUp ? "Already have an account? Sign In" : "Need an account? Register here"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
