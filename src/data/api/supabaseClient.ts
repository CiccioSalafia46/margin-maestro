import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "";

if (!supabaseUrl || !supabasePublishableKey) {
  // Soft warning — do NOT throw at module load. Components calling Supabase
  // will surface a friendly error instead of crashing the whole app.
  // Never log the key value itself.
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY at module load.",
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      // Build 1.0A: in-memory only. No localStorage persistence for sessions
      // or active restaurant id.
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: true,
    },
  },
);
