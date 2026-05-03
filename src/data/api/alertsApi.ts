// Alerts API — Build 1.8.
// All calls go through the browser Supabase client; RLS enforces tenant scoping.

import { supabase } from "./supabaseClient";
import { getMenuAnalyticsData } from "./menuAnalyticsApi";
import { getImpactCascadeRuns, getImpactCascadeItems } from "./impactCascadeApi";
import { getPriceLogEntries } from "./priceLogApi";
import { getRestaurantSettings } from "./settingsApi";
import type { ApiError, AlertRow, AlertSummary, AlertType, AlertSeverity } from "./types";

function toApiError(e: unknown): ApiError {
  const raw = typeof e === "object" && e !== null && "message" in e ? String((e as { message?: unknown }).message ?? "") : String(e ?? "");
  const code = (e as { code?: string } | null)?.code;
  if (raw.includes("not authenticated")) return { code: "auth", message: "Please sign in again." };
  if (code === "42501" || /permission denied|row-level security/i.test(raw)) return { code: "permission", message: "You don't have permission." };
  return { code: "unknown", message: raw || "Something went wrong." };
}

// ── Queries ──────────────────────────────────────────────────────────

export async function getAlerts(restaurantId: string): Promise<AlertRow[]> {
  const { data, error } = await supabase.from("alerts").select("*").eq("restaurant_id", restaurantId).order("detected_at", { ascending: false });
  if (error) throw toApiError(error);
  return (data ?? []) as unknown as AlertRow[];
}

export function deriveAlertSummary(alerts: AlertRow[]): AlertSummary {
  return {
    total: alerts.length,
    open: alerts.filter((a) => a.status === "open").length,
    critical: alerts.filter((a) => a.severity === "critical" && a.status === "open").length,
    warning: alerts.filter((a) => a.severity === "warning" && a.status === "open").length,
    info: alerts.filter((a) => a.severity === "info" && a.status === "open").length,
    acknowledged: alerts.filter((a) => a.status === "acknowledged").length,
    resolved: alerts.filter((a) => a.status === "resolved").length,
    dismissed: alerts.filter((a) => a.status === "dismissed").length,
  };
}

// ── Status Actions ───────────────────────────────────────────────────

export async function acknowledgeAlert(restaurantId: string, alertId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("alerts").update({ status: "acknowledged", acknowledged_at: new Date().toISOString(), acknowledged_by: userId }).eq("id", alertId).eq("restaurant_id", restaurantId);
  if (error) throw toApiError(error);
}

export async function resolveAlert(restaurantId: string, alertId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("alerts").update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: userId }).eq("id", alertId).eq("restaurant_id", restaurantId);
  if (error) throw toApiError(error);
}

export async function dismissAlert(restaurantId: string, alertId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("alerts").update({ status: "dismissed", dismissed_at: new Date().toISOString(), dismissed_by: userId }).eq("id", alertId).eq("restaurant_id", restaurantId);
  if (error) throw toApiError(error);
}

// ── Generation ───────────────────────────────────────────────────────

async function insertAlertIfMissing(
  restaurantId: string,
  alertType: AlertType,
  severity: AlertSeverity,
  title: string,
  message: string,
  opts: { recommended_action?: string; entity_type?: string; entity_id?: string; recipe_id?: string; ingredient_id?: string; batch_id?: string; impact_cascade_run_id?: string; impact_cascade_item_id?: string },
): Promise<boolean> {
  // Check for existing open alert of same type + entity
  const matchField = opts.recipe_id ? "recipe_id" : opts.ingredient_id ? "ingredient_id" : opts.impact_cascade_item_id ? "impact_cascade_item_id" : null;
  const matchValue = opts.recipe_id ?? opts.ingredient_id ?? opts.impact_cascade_item_id ?? null;

  if (matchField && matchValue) {
    const { data: existing } = await supabase.from("alerts").select("id").eq("restaurant_id", restaurantId).eq("alert_type", alertType).eq(matchField, matchValue).eq("status", "open").limit(1);
    if (existing && existing.length > 0) return false;
  }

  const { error } = await supabase.from("alerts").insert({
    restaurant_id: restaurantId,
    alert_type: alertType,
    severity,
    title,
    message,
    recommended_action: opts.recommended_action ?? null,
    entity_type: opts.entity_type ?? null,
    entity_id: opts.entity_id ?? null,
    recipe_id: opts.recipe_id ?? null,
    ingredient_id: opts.ingredient_id ?? null,
    batch_id: opts.batch_id ?? null,
    impact_cascade_run_id: opts.impact_cascade_run_id ?? null,
    impact_cascade_item_id: opts.impact_cascade_item_id ?? null,
  });
  if (error) throw toApiError(error);
  return true;
}

export async function generateAlertsForRestaurant(restaurantId: string): Promise<{ created: number }> {
  let created = 0;
  const settings = await getRestaurantSettings(restaurantId);
  const targetGpm = settings?.target_gpm ?? 0.78;
  const spikeThreshold = settings?.ingredient_spike_threshold_percent ?? 0.10;

  // A. Menu Analytics alerts
  try {
    const { rows } = await getMenuAnalyticsData(restaurantId);
    for (const row of rows) {
      // dish_below_target
      if (row.gpm != null && row.on_target === false && row.menu_price != null && row.menu_price > 0) {
        const gap = targetGpm - row.gpm;
        const sev: AlertSeverity = gap > 0.10 ? "critical" : "warning";
        const ok = await insertAlertIfMissing(restaurantId, "dish_below_target", sev,
          `${row.dish_name} is below target GPM`,
          `GPM is ${(row.gpm * 100).toFixed(1)}% vs target ${(targetGpm * 100).toFixed(0)}%.`,
          { recommended_action: row.suggested_menu_price != null ? `Consider raising price to $${row.suggested_menu_price.toFixed(2)}.` : undefined, entity_type: "recipe", recipe_id: row.recipe_id },
        );
        if (ok) created++;
      }
      // missing_menu_price
      if (row.menu_price == null || row.menu_price <= 0) {
        const ok = await insertAlertIfMissing(restaurantId, "missing_menu_price", "info",
          `${row.dish_name} has no menu price`,
          "Set a menu price to enable margin analysis.",
          { recommended_action: "Open the recipe editor and set a menu price.", entity_type: "recipe", recipe_id: row.recipe_id },
        );
        if (ok) created++;
      }
      // incomplete_costing
      if (row.status === "incomplete" || row.status === "error") {
        const ok = await insertAlertIfMissing(restaurantId, "incomplete_costing", "warning",
          `${row.dish_name} has incomplete costing`,
          row.issues.join(" "),
          { entity_type: "recipe", recipe_id: row.recipe_id },
        );
        if (ok) created++;
      }
    }
  } catch { /* menu analytics may fail if no dishes */ }

  // B. Impact Cascade alerts
  try {
    const runs = await getImpactCascadeRuns(restaurantId);
    if (runs.length > 0) {
      const latestRun = runs[0];
      const items = await getImpactCascadeItems(restaurantId, latestRun.id);
      for (const item of items) {
        if (item.newly_below_target) {
          const ok = await insertAlertIfMissing(restaurantId, "dish_newly_below_target", "critical",
            `${item.dish_name_at_time} fell below target after price update`,
            `GPM dropped from ${item.old_gpm != null ? (Number(item.old_gpm) * 100).toFixed(1) : "?"}% to ${item.new_gpm != null ? (Number(item.new_gpm) * 100).toFixed(1) : "?"}%.`,
            { recommended_action: item.suggested_menu_price != null ? `Suggested price: $${Number(item.suggested_menu_price).toFixed(2)}.` : undefined, entity_type: "impact_cascade_item", impact_cascade_item_id: item.id, impact_cascade_run_id: latestRun.id, batch_id: latestRun.batch_id, recipe_id: item.dish_recipe_id ?? undefined },
          );
          if (ok) created++;
        }
        if (item.gpm_delta != null && Number(item.gpm_delta) < -0.02) {
          const ok = await insertAlertIfMissing(restaurantId, "impact_cascade_margin_drop", "warning",
            `${item.dish_name_at_time} margin dropped ${(Math.abs(Number(item.gpm_delta)) * 100).toFixed(1)} pp`,
            `COGS increased by $${item.cogs_delta_per_serving != null ? Number(item.cogs_delta_per_serving).toFixed(4) : "?"}/serving.`,
            { entity_type: "impact_cascade_item", impact_cascade_item_id: item.id, impact_cascade_run_id: latestRun.id, batch_id: latestRun.batch_id, recipe_id: item.dish_recipe_id ?? undefined },
          );
          if (ok) created++;
        }
      }
    }
  } catch { /* cascade may not exist */ }

  // C. Ingredient cost spike alerts
  try {
    const log = await getPriceLogEntries(restaurantId);
    const changes = log.filter((e) => e.event_type === "change");
    for (const entry of changes) {
      if (entry.delta_recipe_unit_cost_percent != null && Math.abs(Number(entry.delta_recipe_unit_cost_percent)) >= spikeThreshold) {
        const ok = await insertAlertIfMissing(restaurantId, "ingredient_cost_spike",
          Number(entry.delta_recipe_unit_cost_percent) > 0 ? "warning" : "info",
          `${entry.ingredient_name_at_time} cost ${Number(entry.delta_recipe_unit_cost_percent) > 0 ? "increased" : "decreased"} ${(Math.abs(Number(entry.delta_recipe_unit_cost_percent)) * 100).toFixed(1)}%`,
          `Recipe unit cost changed from ${entry.old_recipe_unit_cost != null ? Number(entry.old_recipe_unit_cost).toFixed(6) : "?"} to ${entry.new_recipe_unit_cost != null ? Number(entry.new_recipe_unit_cost).toFixed(6) : "?"}.`,
          { entity_type: "ingredient", ingredient_id: entry.ingredient_id ?? undefined, batch_id: entry.batch_id ?? undefined },
        );
        if (ok) created++;
      }
    }
  } catch { /* log may be empty */ }

  return { created };
}
