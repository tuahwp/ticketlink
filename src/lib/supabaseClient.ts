import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kcvtvfnfeytxxzjugulk.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseAnonKey) {
  if (typeof window !== "undefined") {
    console.warn(
      "Supabase Realtime warning: NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in your .env file. Real-time updates will be disabled."
    );
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
});
