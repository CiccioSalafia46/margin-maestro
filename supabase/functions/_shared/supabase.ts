import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function createSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export function createSupabaseFromAuth(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
}

export async function getAuthUser(authHeader: string) {
  const supabase = createSupabaseFromAuth(authHeader);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  return { user, supabase };
}

export async function verifyRestaurantOwner(supabaseAdmin: ReturnType<typeof createSupabaseAdmin>, userId: string, restaurantId: string) {
  const { data } = await supabaseAdmin
    .from("restaurant_members")
    .select("role")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", userId)
    .single();
  if (!data || data.role !== "owner") throw new Error("Only restaurant owners can manage billing");
}
