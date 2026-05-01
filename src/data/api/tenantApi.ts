import { supabase } from "./supabaseClient";
import type {
  Restaurant,
  RestaurantMembership,
  RestaurantRole,
  RestaurantSettingsRow,
} from "./types";

export async function listMyRestaurants(): Promise<RestaurantMembership[]> {
  const { data, error } = await supabase
    .from("restaurant_members")
    .select("role, restaurants:restaurant_id(id, name, created_by, created_at, updated_at)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .map((row: { role: string; restaurants: Restaurant | null }) => {
      if (!row.restaurants) return null;
      return {
        role: row.role as RestaurantRole,
        restaurant: row.restaurants,
      } satisfies RestaurantMembership;
    })
    .filter((x): x is RestaurantMembership => x !== null);
}

export async function createRestaurantWithOwner(name: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_restaurant_with_owner", {
    p_name: name,
  });
  if (error) throw error;
  return data as string;
}

export async function getRestaurantSettings(
  restaurantId: string,
): Promise<RestaurantSettingsRow | null> {
  const { data, error } = await supabase
    .from("restaurant_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  return (data as RestaurantSettingsRow | null) ?? null;
}

const ACTIVE_RESTAURANT_KEY = "marginiq.activeRestaurantId";

export function getStoredActiveRestaurantId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_RESTAURANT_KEY);
}

export function setStoredActiveRestaurantId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ACTIVE_RESTAURANT_KEY, id);
  else window.localStorage.removeItem(ACTIVE_RESTAURANT_KEY);
}
