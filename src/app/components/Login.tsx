"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isInvited, setIsInvited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      const nameParam = params.get("name");
      const modeParam = params.get("mode");

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
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name || undefined,
            },
          },
        });
        if (signUpError) throw signUpError;
        setMessage("Registration successful! You can now log in.");
        setIsSignUp(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800 antialiased selection:bg-indigo-500/20">
      {/* Left Column: Visual Cover Illustration (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-white border-r border-slate-200">
        {/* Ambient top light */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-50/50 rounded-full blur-[120px] pointer-events-none" />
        
        {/* Header logo / branding */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-slate-800 tracking-tight uppercase">
            Nexus TicketLink
          </span>
        </div>

        {/* Centerpiece: Beautiful Illustration Mockup */}
        <div className="relative z-10 my-auto max-w-lg mx-auto">
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xl bg-white p-2 transition-all duration-500 hover:border-indigo-200">
            <img
              src="/login_cover.jpg"
              alt="Dashboard Cover Preview"
              className="w-full h-auto rounded-xl object-cover transition-transform duration-700 hover:scale-[1.01]"
            />
            {/* Ambient decoration overlays */}
            <div className="absolute -bottom-4 -right-4 w-28 h-28 bg-indigo-200/20 rounded-full blur-2xl transition-all duration-550" />
          </div>
          
          <div className="mt-8 text-left space-y-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight tracking-tight">
              Enterprise Dispatch & <br />
              <span className="text-indigo-600">SLA Optimization Engine</span>
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed font-medium">
              Seamlessly monitor active tickets, coordinate Field Engineers, upload verified service reports, and optimize client SLA response times in one dynamic workspace.
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-slate-400 flex justify-between font-mono font-medium">
          <span>SYSTEM VERSION: v2.4.0</span>
          <span>© 2026 NEXUS INC.</span>
        </div>
      </div>

      {/* Right Column: Credentials Input Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative bg-slate-50">
        {/* Form container */}
        <div className="w-full max-w-md space-y-8 relative z-10 bg-white border border-slate-200 rounded-2xl shadow-xl p-8 sm:p-10">
          {/* Mobile Header Branding (Only visible on screens < lg) */}
          <div className="flex lg:hidden flex-col items-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 mb-3 border border-indigo-100">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
              </svg>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight uppercase">Nexus TicketLink</h2>
          </div>

          <div className="text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isSignUp ? "Register Account" : "Access Workspace"}
            </h2>
            <p className="text-sm text-slate-500 mt-2 font-medium">
              {isSignUp 
                ? "Sign up to begin setting up your profiles and dispatches" 
                : "Sign in to view assignments or dispatch engineers"}
            </p>
          </div>

          {/* Invitation welcome block */}
          {isInvited && isSignUp && (
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-700 flex items-start gap-2.5 leading-relaxed">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-indigo-600 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <div>
                <span className="font-bold block">FE Invitation Confirmed</span>
                <span className="mt-0.5 block">Your profile name and email have been prefilled. Set a password to activate your account.</span>
              </div>
            </div>
          )}

          {/* Message / Error Notification */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-600 flex items-start gap-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 flex-shrink-0 text-rose-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {message && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-600 flex items-start gap-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 flex-shrink-0 text-emerald-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span className="font-semibold">{message}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  disabled={isInvited}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ahmad Zaki"
                  className={`w-full px-4 py-2.5 rounded-xl border text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all text-xs font-semibold ${
                    isInvited ? "bg-slate-100 border-slate-200 cursor-not-allowed opacity-80" : "bg-white border-slate-200"
                  }`}
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                disabled={isInvited}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className={`w-full px-4 py-2.5 rounded-xl border text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all text-xs font-semibold ${
                  isInvited ? "bg-slate-100 border-slate-200 cursor-not-allowed opacity-80" : "bg-white border-slate-200"
                }`}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all text-xs font-semibold"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 mt-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 hover:shadow-indigo-500/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all duration-200 shadow-md flex justify-center items-center text-xs disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : isSignUp ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Toggle button (only show if not invited, or let them switch if they want) */}
          <div className="text-center pt-2">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setMessage(null);
              }}
              className="text-xs text-indigo-600 hover:text-indigo-500 font-bold transition-colors focus:outline-none border-b border-indigo-500/0 hover:border-indigo-500/50"
            >
              {isSignUp ? "Already have an account? Sign In" : "Need an account? Register here"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
