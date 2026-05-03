// Billing API — Build 2.2.
// Browser-side queries for billing state. Checkout/portal creation calls Edge Functions.

import { supabase } from "./supabaseClient";
import type { ApiError, BillingCustomerRow, BillingSubscriptionRow, BillingSummary } from "./types";

function toApiError(e: unknown): ApiError {
  const raw = typeof e === "object" && e !== null && "message" in e ? String((e as { message?: unknown }).message ?? "") : String(e ?? "");
  return { code: "unknown", message: raw || "Something went wrong." };
}

export async function getBillingCustomer(restaurantId: string): Promise<BillingCustomerRow | null> {
  const { data, error } = await supabase.from("billing_customers").select("*").eq("restaurant_id", restaurantId).maybeSingle();
  if (error) throw toApiError(error);
  return (data as unknown as BillingCustomerRow) ?? null;
}

export async function getBillingSubscription(restaurantId: string): Promise<BillingSubscriptionRow | null> {
  const { data, error } = await supabase.from("billing_subscriptions").select("*").eq("restaurant_id", restaurantId).maybeSingle();
  if (error) throw toApiError(error);
  return (data as unknown as BillingSubscriptionRow) ?? null;
}

export async function getBillingSummary(restaurantId: string): Promise<BillingSummary> {
  const [customer, subscription] = await Promise.all([
    getBillingCustomer(restaurantId),
    getBillingSubscription(restaurantId),
  ]);
  return {
    has_customer: !!customer,
    has_subscription: !!subscription && subscription.status !== "none",
    status: subscription?.status ?? "none",
    plan_key: subscription?.plan_key ?? null,
    current_period_end: subscription?.current_period_end ?? null,
    cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
    billing_email: customer?.billing_email ?? null,
  };
}

export async function createCheckoutSession(restaurantId: string): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: { restaurant_id: restaurantId },
  });
  if (error) throw toApiError(error);
  if (!data?.url) throw { code: "unknown", message: "No checkout URL returned." } as ApiError;
  return { url: data.url as string };
}

export async function createCustomerPortalSession(restaurantId: string): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke("create-customer-portal-session", {
    body: { restaurant_id: restaurantId },
  });
  if (error) throw toApiError(error);
  if (!data?.url) throw { code: "unknown", message: "No portal URL returned." } as ApiError;
  return { url: data.url as string };
}
