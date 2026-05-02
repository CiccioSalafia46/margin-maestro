// Browser Supabase client — Build 1.0E session persistence fix.
//
// Previous code used a Proxy singleton that passed
//   storage: typeof window !== 'undefined' ? localStorage : undefined
// which poisoned the client with storage=undefined when the module was
// first evaluated during TanStack Start server-side rendering.
//
// Fix: do NOT set `storage` explicitly. @supabase/supabase-js uses a
// built-in default that detects localStorage on the browser and falls
// back to in-memory storage on the server. This works correctly in both
// SSR and client contexts without a manual typeof-window guard.
//
// The Proxy wrapper was also removed because it forwarded the wrong
// `receiver` (the Proxy itself, not the real client) via Reflect.get,
// which can break internal Supabase methods that rely on `this` binding.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  const missing = [
    ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
    ...(!SUPABASE_PUBLISHABLE_KEY ? ['SUPABASE_PUBLISHABLE_KEY'] : []),
  ];
  const message = `Missing Supabase environment variable(s): ${missing.join(', ')}. Connect Supabase in Lovable Cloud.`;
  console.error(`[Supabase] ${message}`);
  throw new Error(message);
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

