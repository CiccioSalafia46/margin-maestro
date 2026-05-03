import Stripe from "https://esm.sh/stripe@14?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseAdmin, getAuthUser, verifyRestaurantOwner } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { user } = await getAuthUser(authHeader);
    const { restaurant_id } = await req.json();
    if (!restaurant_id) return new Response(JSON.stringify({ error: "restaurant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseAdmin = createSupabaseAdmin();
    await verifyRestaurantOwner(supabaseAdmin, user.id, restaurant_id);

    const { data: customer } = await supabaseAdmin.from("billing_customers").select("stripe_customer_id").eq("restaurant_id", restaurant_id).maybeSingle();
    if (!customer?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: "No billing customer found. Start a subscription first." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:8085";

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${siteUrl}/settings?tab=billing`,
    });

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[create-customer-portal-session]", message);
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
