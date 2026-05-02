import { supabase as generatedSupabase } from "@/integrations/supabase/client";

export const AUTH_SESSION_CONFIG = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
} as const;

export const supabase = generatedSupabase;
