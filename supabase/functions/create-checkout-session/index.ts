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

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:8085";
    const priceId = Deno.env.get("STRIPE_PRICE_ID");
    if (!priceId) return new Response(JSON.stringify({ error: "STRIPE_PRICE_ID not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Get or create Stripe customer
    const { data: existing } = await supabaseAdmin.from("billing_customers").select("stripe_customer_id").eq("restaurant_id", restaurant_id).maybeSingle();

    let stripeCustomerId: string;
    if (existing?.stripe_customer_id) {
      stripeCustomerId = existing.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { restaurant_id, user_id: user.id },
      });
      stripeCustomerId = customer.id;
      await supabaseAdmin.from("billing_customers").upsert({
        restaurant_id,
        stripe_customer_id: stripeCustomerId,
        billing_email: user.email,
        created_by: user.id,
      }, { onConflict: "restaurant_id" });
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/settings?tab=billing&checkout=success`,
      cancel_url: `${siteUrl}/settings?tab=billing&checkout=cancelled`,
      metadata: { restaurant_id, user_id: user.id },
      subscription_data: { metadata: { restaurant_id } },
    });

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[create-checkout-session]", message);
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
