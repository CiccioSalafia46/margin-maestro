// Edge Function: send-team-invitation
// Build 3.1 — Transactional Invite Emails.
//
// Sends a transactional email containing the accept-invite link for a pending
// restaurant_invitations row. Provider-neutral: currently wired to Resend via
// fetch (no SDK dependency). If RESEND_API_KEY is not set, the function still
// validates the invitation and returns { sent: false, provider_configured:
// false, message } so the caller can fall back to manual link copy.
//
// Security:
// - Requires authenticated Supabase JWT.
// - Caller must be the owner of the invitation's restaurant.
// - Uses service-role admin client (Deno-only) to read invitation details.
// - Never returns the provider API response raw, never logs tokens or secrets.
//
// Required Edge Function secrets (set via `supabase secrets set ...`):
//   SUPABASE_URL                — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY   — service-role key (server-only)
//   SITE_URL                    — public origin used to build the invite link
//   RESEND_API_KEY              — optional; when unset the function gracefully
//                                  reports provider_configured=false
//   FROM_EMAIL                  — sender; defaults to "Margin Maestro
//                                  <onboarding@resend.dev>" if unset

import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseAdmin, getAuthUser, verifyRestaurantOwner } from "../_shared/supabase.ts";

interface InvitationRow {
  id: string;
  restaurant_id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  expires_at: string | null;
}

interface RestaurantRow {
  id: string;
  name: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(opts: {
  restaurantName: string;
  role: string;
  inviteUrl: string;
  expiresAt: string | null;
  recipientEmail: string;
}): string {
  const exp = opts.expiresAt ? new Date(opts.expiresAt).toUTCString() : "no expiration set";
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>You're invited to Margin Maestro</title></head>
<body style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;max-width:560px;margin:24px auto;padding:16px;">
  <h1 style="font-size:18px;margin:0 0 12px;">You're invited to Margin Maestro</h1>
  <p>You've been invited to join <strong>${escapeHtml(opts.restaurantName)}</strong> on Margin Maestro as <strong>${escapeHtml(opts.role)}</strong>.</p>
  <p>
    <a href="${opts.inviteUrl}"
       style="display:inline-block;padding:10px 16px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;">
      Accept invitation
    </a>
  </p>
  <p style="font-size:12px;color:#6b7280;">
    Or open this link in your browser:<br>
    <span style="word-break:break-all;">${opts.inviteUrl}</span>
  </p>
  <p style="font-size:12px;color:#6b7280;">
    You must accept the invitation while signed in with <strong>${escapeHtml(opts.recipientEmail)}</strong>.
  </p>
  <p style="font-size:12px;color:#6b7280;">Invitation expires: ${escapeHtml(exp)}.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
  <p style="font-size:11px;color:#9ca3af;">
    If you weren't expecting this invitation, you can safely ignore this email.
  </p>
</body></html>`;
}

function buildEmailText(opts: {
  restaurantName: string;
  role: string;
  inviteUrl: string;
  expiresAt: string | null;
  recipientEmail: string;
}): string {
  const exp = opts.expiresAt ? new Date(opts.expiresAt).toUTCString() : "no expiration set";
  return [
    `You're invited to Margin Maestro`,
    ``,
    `You've been invited to join ${opts.restaurantName} on Margin Maestro as ${opts.role}.`,
    ``,
    `Open this link to accept:`,
    opts.inviteUrl,
    ``,
    `You must accept the invitation while signed in with ${opts.recipientEmail}.`,
    `Invitation expires: ${exp}.`,
    ``,
    `If you weren't expecting this, you can safely ignore this email.`,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user } = await getAuthUser(authHeader);

    let body: { restaurant_id?: string; invitation_id?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const restaurantId = body.restaurant_id;
    const invitationId = body.invitation_id;
    if (!restaurantId || !invitationId) {
      return new Response(
        JSON.stringify({ error: "restaurant_id and invitation_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Owner-only — match Build 2.1 invitation creation rule.
    try {
      await verifyRestaurantOwner(supabaseAdmin, user.id, restaurantId);
    } catch {
      return new Response(JSON.stringify({ error: "Only restaurant owners can send invitation emails" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch invitation server-side.
    const { data: invRaw, error: invErr } = await supabaseAdmin
      .from("restaurant_invitations")
      .select("id, restaurant_id, email, role, status, token, expires_at")
      .eq("id", invitationId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (invErr) {
      return new Response(JSON.stringify({ error: "Invitation lookup failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const invitation = invRaw as InvitationRow | null;
    if (!invitation) {
      return new Response(JSON.stringify({ error: "Invitation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (invitation.status !== "pending") {
      return new Response(
        JSON.stringify({ error: `Invitation status is "${invitation.status}", not "pending"` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (invitation.expires_at && new Date(invitation.expires_at).getTime() <= Date.now()) {
      return new Response(JSON.stringify({ error: "Invitation has expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch restaurant name for the email body.
    const { data: restRaw } = await supabaseAdmin
      .from("restaurants")
      .select("id, name")
      .eq("id", restaurantId)
      .maybeSingle();
    const restaurant = restRaw as RestaurantRow | null;
    const restaurantName = restaurant?.name ?? "Margin Maestro";

    const siteUrl = (Deno.env.get("SITE_URL") ?? "https://margin-maestro.vercel.app").replace(/\/+$/, "");
    const inviteUrl = `${siteUrl}/accept-invite?token=${encodeURIComponent(invitation.token)}`;

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          sent: false,
          provider_configured: false,
          message: "Email provider is not configured yet. Use the copy-link option to share the invitation manually.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fromEmail = Deno.env.get("FROM_EMAIL") ?? "Margin Maestro <onboarding@resend.dev>";

    const emailHtml = buildEmailHtml({
      restaurantName,
      role: invitation.role,
      inviteUrl,
      expiresAt: invitation.expires_at,
      recipientEmail: invitation.email,
    });
    const emailText = buildEmailText({
      restaurantName,
      role: invitation.role,
      inviteUrl,
      expiresAt: invitation.expires_at,
      recipientEmail: invitation.email,
    });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [invitation.email],
        subject: "You're invited to Margin Maestro",
        html: emailHtml,
        text: emailText,
      }),
    });

    if (!resendResponse.ok) {
      // Do not surface raw provider response.
      console.error("[send-team-invitation] provider responded with status", resendResponse.status);
      return new Response(
        JSON.stringify({
          sent: false,
          provider_configured: true,
          message: "Email provider rejected the request. The invitation is still pending — share the link manually.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        sent: true,
        provider_configured: true,
        message: "Invitation email sent.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[send-team-invitation]", message);
    return new Response(JSON.stringify({ error: "Failed to send invitation email" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
