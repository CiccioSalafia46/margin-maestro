// Team Management API — Build 2.1.
// All calls go through the browser Supabase client; RLS enforces tenant scoping.

import { supabase } from "./supabaseClient";
import type { ApiError, RestaurantInvitationRow, RestaurantRole, TeamMember } from "./types";

function toApiError(e: unknown): ApiError {
  const raw = typeof e === "object" && e !== null && "message" in e ? String((e as { message?: unknown }).message ?? "") : String(e ?? "");
  const code = (e as { code?: string } | null)?.code;
  if (raw.includes("not authenticated")) return { code: "auth", message: "Please sign in again." };
  if (code === "23505" || /duplicate key/i.test(raw)) return { code: "duplicate", message: "A pending invitation for this email already exists." };
  if (code === "42501" || /permission denied|row-level security/i.test(raw)) return { code: "permission", message: "You don't have permission." };
  if (/sole owner\|last.*owner/i.test(raw)) return { code: "validation", message: "Cannot remove or demote the sole owner." };
  return { code: "unknown", message: raw || "Something went wrong." };
}

// ── Team Members ─────────────────────────────────────────────────────

export async function getTeamMembers(restaurantId: string): Promise<TeamMember[]> {
  // Step 1: Get members
  const { data: members, error: memErr } = await supabase
    .from("restaurant_members")
    .select("user_id, role, created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });
  if (memErr) throw toApiError(memErr);

  const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (userIds.length === 0) return [];

  // Step 2: Get profiles separately (profiles.id = auth.users.id)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; email: string | null; full_name: string | null }) => [p.id, p]),
  );

  // Step 3: Merge
  return (members ?? []).map((row: { user_id: string; role: string; created_at: string }) => {
    const profile = profileMap.get(row.user_id);
    return {
      user_id: row.user_id,
      email: profile?.email ?? null,
      full_name: profile?.full_name ?? null,
      role: row.role as RestaurantRole,
      joined_at: row.created_at,
    };
  });
}

export async function updateMemberRole(restaurantId: string, memberUserId: string, role: RestaurantRole): Promise<void> {
  const { error } = await supabase
    .from("restaurant_members")
    .update({ role })
    .eq("restaurant_id", restaurantId)
    .eq("user_id", memberUserId);
  if (error) throw toApiError(error);
}

export async function removeTeamMember(restaurantId: string, memberUserId: string): Promise<void> {
  const { error } = await supabase
    .from("restaurant_members")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("user_id", memberUserId);
  if (error) throw toApiError(error);
}

// ── Invitations ──────────────────────────────────────────────────────

export async function getRestaurantInvitations(restaurantId: string): Promise<RestaurantInvitationRow[]> {
  const { data, error } = await supabase
    .from("restaurant_invitations")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw toApiError(error);
  return (data ?? []) as unknown as RestaurantInvitationRow[];
}

export async function createRestaurantInvitation(
  restaurantId: string,
  email: string,
  role: RestaurantRole,
  userId: string,
  note?: string,
): Promise<RestaurantInvitationRow> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) throw { code: "validation", message: "Valid email required." } as ApiError;

  const { data, error } = await supabase
    .from("restaurant_invitations")
    .insert({
      restaurant_id: restaurantId,
      email: trimmed,
      role,
      invited_by: userId,
      note: note?.trim() || null,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw toApiError(error);
  return data as unknown as RestaurantInvitationRow;
}

export async function cancelRestaurantInvitation(restaurantId: string, invitationId: string): Promise<void> {
  const { error } = await supabase
    .from("restaurant_invitations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("restaurant_id", restaurantId);
  if (error) throw toApiError(error);
}

// ── Transactional Invitation Email — Build 3.1 ─────────────────────

export interface SendInvitationEmailResult {
  /** True when the provider reports successful delivery. */
  sent: boolean;
  /** False when no email provider is configured server-side (graceful fallback). */
  provider_configured: boolean;
  /** Friendly message safe to surface to the operator. */
  message: string;
}

export function canSendTeamInvitationEmail(role: RestaurantRole | null): boolean {
  // Mirrors existing invitation creation rule: owner only.
  return role === "owner";
}

export async function sendTeamInvitationEmail(
  restaurantId: string,
  invitationId: string,
): Promise<SendInvitationEmailResult> {
  const { data, error } = await supabase.functions.invoke<SendInvitationEmailResult>(
    "send-team-invitation",
    { body: { restaurant_id: restaurantId, invitation_id: invitationId } },
  );
  if (error) {
    // Sanitize: never surface raw provider/edge error to UI.
    const msg = error.message ?? "Edge Function call failed.";
    if (/missing auth|not authenticated/i.test(msg)) {
      throw { code: "auth", message: "Please sign in again." } as ApiError;
    }
    if (/owners can send/i.test(msg) || /permission/i.test(msg)) {
      throw { code: "permission", message: "Only restaurant owners can send invitation emails." } as ApiError;
    }
    throw { code: "unknown", message: "Invitation email could not be sent." } as ApiError;
  }
  // Normalize a missing/empty response into a safe default.
  if (!data) {
    return {
      sent: false,
      provider_configured: false,
      message: "Email provider is not configured yet. Copy and share the invite link manually.",
    };
  }
  return data;
}

// ── Accept Invite ────────────────────────────────────────────────────

export async function acceptRestaurantInvitation(token: string): Promise<{ restaurant_id: string; role: string; already_member: boolean }> {
  const { data, error } = await supabase.rpc("accept_restaurant_invitation", { p_token: token });
  if (error) throw toApiError(error);
  return data as { restaurant_id: string; role: string; already_member: boolean };
}

// ── Pending invitations for current user ─────────────────────────────

export async function getPendingInvitationsForCurrentUser(): Promise<RestaurantInvitationRow[]> {
  const { data, error } = await supabase
    .from("restaurant_invitations")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw toApiError(error);
  return (data ?? []) as unknown as RestaurantInvitationRow[];
}
