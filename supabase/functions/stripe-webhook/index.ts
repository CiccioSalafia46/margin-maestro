import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createSupabaseAdmin } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

Deno.serve(async (req) => {
  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) return new Response("Missing signature", { status: 400 });

    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) return new Response("Webhook secret not configured", { status: 500 });

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error("[stripe-webhook] Signature verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Idempotency check
    const { data: existing } = await supabaseAdmin.from("billing_events").select("id").eq("stripe_event_id", event.id).maybeSingle();
    if (existing) return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });

    let restaurantId: string | null = null;
    let processingStatus = "processed";
    let errorMessage: string | null = null;

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          restaurantId = (session.metadata?.restaurant_id) ?? null;
          if (restaurantId && session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription as string);
            await upsertSubscription(supabaseAdmin, restaurantId, session.customer as string, sub);
          }
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          restaurantId = sub.metadata?.restaurant_id ?? await findRestaurantByCustomer(supabaseAdmin, sub.customer as string);
          if (restaurantId) await upsertSubscription(supabaseAdmin, restaurantId, sub.customer as string, sub);
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          restaurantId = sub.metadata?.restaurant_id ?? await findRestaurantByCustomer(supabaseAdmin, sub.customer as string);
          if (restaurantId) {
            await supabaseAdmin.from("billing_subscriptions").upsert({
              restaurant_id: restaurantId,
              stripe_customer_id: sub.customer as string,
              stripe_subscription_id: sub.id,
              status: "cancelled",
              cancel_at_period_end: false,
            }, { onConflict: "restaurant_id" });
          }
          break;
        }
        default:
          processingStatus = "ignored";
      }
    } catch (err) {
      processingStatus = "failed";
      errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[stripe-webhook] Error processing ${event.type}:`, errorMessage);
    }

    // Record event
    await supabaseAdmin.from("billing_events").insert({
      restaurant_id: restaurantId,
      stripe_event_id: event.id,
      event_type: event.type,
      processing_status: processingStatus,
      error_message: errorMessage,
      payload: { type: event.type, id: event.id },
      processed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error("[stripe-webhook] Unhandled error:", err);
    return new Response("Internal error", { status: 500 });
  }
});

async function upsertSubscription(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  restaurantId: string,
  customerId: string,
  sub: Stripe.Subscription,
) {
  const item = sub.items.data[0];
  await supabaseAdmin.from("billing_subscriptions").upsert({
    restaurant_id: restaurantId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    stripe_price_id: item?.price?.id ?? null,
    stripe_product_id: typeof item?.price?.product === "string" ? item.price.product : null,
    plan_key: item?.price?.lookup_key ?? null,
    status: sub.status,
    current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at_period_end: sub.cancel_at_period_end,
    trial_start: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    quantity: item?.quantity ?? null,
  }, { onConflict: "restaurant_id" });
}

async function findRestaurantByCustomer(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  customerId: string,
): Promise<string | null> {
  const { data } = await supabaseAdmin.from("billing_customers").select("restaurant_id").eq("stripe_customer_id", customerId).maybeSingle();
  return data?.restaurant_id ?? null;
}
