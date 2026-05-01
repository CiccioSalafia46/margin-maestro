import { supabase } from "./supabaseClient";
import type { Profile } from "./types";

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(
  email: string,
  password: string,
  fullName?: string,
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: fullName ? { full_name: fullName } : undefined,
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .eq("id", userRes.user.id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
