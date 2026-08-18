"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { syncUserAndGetProfile } from "@/app/actions";
import { Session } from "@supabase/supabase-js";
import Login from "@/app/components/Login";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "SUPERADMIN" | "MODERATOR" | "AGENT" | "FIELD_ENGINEER";
  partnerId: number | null;
  engineerId: number | null;
  partner?: {
    id: number;
    name: string;
    address?: string | null;
    phone?: string | null;
    companyPhotoUrl?: string | null;
  } | null;
  engineer?: { id: number; name: string } | null;
}

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (s: Session) => {
    try {
      const email = s.user.email;
      if (!email) return;

      const name = s.user.user_metadata?.full_name || s.user.user_metadata?.name || null;
      const profile = await syncUserAndGetProfile(s.user.id, email, name);
      
      setUser(profile as UserProfile);
    } catch (err) {
      console.error("Failed to sync auth user profile:", err);
    }
  };

  const refreshProfile = async () => {
    if (session) {
      await fetchProfile(session);
    }
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      setSession(activeSession);
      if (activeSession) {
        fetchProfile(activeSession).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        if (newSession) {
          setLoading(true);
          await fetchProfile(newSession);
          setLoading(false);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) return;

    const channel = supabase
      .channel(`realtime-current-user-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "User",
        },
        async (payload) => {
          if (payload.new && (payload.new as any).id === session.user.id) {
            console.log("Real-time profile update received for user:", session.user.id);
            await fetchProfile(session);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground transition-colors duration-500">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative flex items-center justify-center w-24 h-24">
            {/* Ambient background glow */}
            <div className="absolute inset-0 bg-indigo-500/5 dark:bg-cyan-500/10 rounded-2xl blur-xl animate-pulse-soft" />
            
            {/* Ticket Card Container */}
            <div className="relative p-4 rounded-2xl bg-card border border-card-border shadow-sm overflow-hidden w-20 h-20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} className="w-12 h-12 text-indigo-600 dark:text-cyan-400 animate-draw">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
              </svg>
              {/* Glowing laser scanning line */}
              <div className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent dark:via-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-scan" />
            </div>
          </div>
          
          <div className="flex flex-col items-center space-y-1 text-center">
            <span className="text-sm font-bold tracking-wider uppercase text-foreground/80">
              Ticket<span className="text-teal-500">Link</span>
            </span>
            <span className="text-xs font-semibold tracking-wide text-muted-text animate-pulse-soft">
              Loading your profile...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
