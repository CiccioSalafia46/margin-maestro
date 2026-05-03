// Price Log + Snapshot API — Build 1.5.
// All calls go through the browser Supabase client; RLS enforces tenant scoping.

import { supabase } from "./supabaseClient";
import { getIngredients } from "./ingredientsApi";
import type {
  ApiError,
  IngredientPriceLogRow,
  IngredientSnapshotRow,
  PriceUpdateBatchRow,
  SnapshotStatus,
} from "./types";

function toApiError(e: unknown): ApiError {
  const raw =
    typeof e === "object" && e !== null && "message" in e
      ? String((e as { message?: unknown }).message ?? "")
      : String(e ?? "");
  const code = (e as { code?: string } | null)?.code;
  if (raw.includes("not authenticated")) return { code: "auth", message: "Please sign in again." };
  if (code === "42501" || /permission denied|row-level security/i.test(raw))
    return { code: "permission", message: "You don't have permission to perform this action." };
  return { code: "unknown", message: raw || "Something went wrong." };
}

// ── Queries ──────────────────────────────────────────────────────────

export async function getPriceLogEntries(
  restaurantId: string,
): Promise<IngredientPriceLogRow[]> {
  const { data, error } = await supabase
    .from("ingredient_price_log")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw toApiError(error);
  return (data ?? []) as unknown as IngredientPriceLogRow[];
}

export async function getPriceUpdateBatches(
  restaurantId: string,
): Promise<PriceUpdateBatchRow[]> {
  const { data, error } = await supabase
    .from("price_update_batches")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw toApiError(error);
  return (data ?? []) as unknown as PriceUpdateBatchRow[];
}

export async function getIngredientSnapshots(
  restaurantId: string,
  baselineVersion?: number,
): Promise<IngredientSnapshotRow[]> {
  let query = supabase
    .from("ingredient_snapshots")
    .select("*")
    .eq("restaurant_id", restaurantId);
  if (baselineVersion != null) {
    query = query.eq("baseline_version", baselineVersion);
  }
  const { data, error } = await query.order("ingredient_name_at_time", { ascending: true });
  if (error) throw toApiError(error);
  return (data ?? []) as unknown as IngredientSnapshotRow[];
}

export async function getSnapshotStatus(
  restaurantId: string,
): Promise<SnapshotStatus> {
  const [snapshots, batches, ingredients] = await Promise.all([
    getIngredientSnapshots(restaurantId),
    getPriceUpdateBatches(restaurantId),
    getIngredients(restaurantId),
  ]);

  const activeIngredients = ingredients.filter((i) => i.is_active);
  const maxVersion = snapshots.reduce((m, s) => Math.max(m, s.baseline_version), 0);
  const latestSnapshots = snapshots.filter((s) => s.baseline_version === maxVersion);
  const latestBatch = batches.find((b) => b.status === "applied") ?? null;

  return {
    initialized: snapshots.length > 0,
    baseline_version: maxVersion || 1,
    snapshot_count: latestSnapshots.length,
    active_ingredient_count: activeIngredients.length,
    coverage_complete:
      activeIngredients.length > 0 &&
      latestSnapshots.length >= activeIngredients.length,
    latest_batch_at: latestBatch?.applied_at ?? null,
  };
}

// ── Baseline Initialization ──────────────────────────────────────────

export async function initializeBaseline(
  restaurantId: string,
  userId: string,
  note?: string,
): Promise<{ batch_id: string; entries_created: number }> {
  // Check if already initialized
  const existing = await getIngredientSnapshots(restaurantId);
  if (existing.length > 0) {
    throw {
      code: "validation",
      message: "Baseline already initialized. Non-destructive baseline reset arrives in a later build.",
    } as ApiError;
  }

  const ingredients = await getIngredients(restaurantId);
  const activeIngredients = ingredients.filter((i) => i.is_active);

  if (activeIngredients.length === 0) {
    throw {
      code: "validation",
      message: "No active ingredients to snapshot. Add ingredients first.",
    } as ApiError;
  }

  // 1. Create batch
  const { data: batch, error: batchErr } = await supabase
    .from("price_update_batches")
    .insert({
      restaurant_id: restaurantId,
      created_by: userId,
      status: "applied",
      source: "baseline_initialization",
      note: note || "Initial baseline",
      baseline_version: 1,
      applied_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (batchErr) throw toApiError(batchErr);

  const batchId = (batch as unknown as PriceUpdateBatchRow).id;

  // 2. Create price log entries (baseline event)
  const logEntries = activeIngredients.map((ing) => {
    const cs = ing.cost_state;
    return {
      restaurant_id: restaurantId,
      batch_id: batchId,
      ingredient_id: ing.id,
      baseline_version: 1,
      ingredient_name_at_time: ing.name,
      supplier_name_at_time: ing.supplier_name,
      ingredient_type_at_time: ing.type,
      old_total_cost: ing.total_cost != null ? Number(ing.total_cost) : null,
      old_quantity: ing.original_quantity != null ? Number(ing.original_quantity) : null,
      old_uom_code: ing.original_uom_code,
      old_unit_cost: cs?.original_unit_cost != null ? Number(cs.original_unit_cost) : null,
      old_recipe_unit_cost: cs?.recipe_unit_cost != null ? Number(cs.recipe_unit_cost) : null,
      new_total_cost: ing.total_cost != null ? Number(ing.total_cost) : null,
      new_quantity: ing.original_quantity != null ? Number(ing.original_quantity) : null,
      new_uom_code: ing.original_uom_code,
      new_unit_cost: cs?.original_unit_cost != null ? Number(cs.original_unit_cost) : null,
      new_recipe_unit_cost: cs?.recipe_unit_cost != null ? Number(cs.recipe_unit_cost) : null,
      delta_recipe_unit_cost_amount: 0,
      delta_recipe_unit_cost_percent: 0,
      event_type: "baseline" as const,
      note: "Baseline",
      created_by: userId,
    };
  });

  const { error: logErr } = await supabase
    .from("ingredient_price_log")
    .insert(logEntries);
  if (logErr) throw toApiError(logErr);

  // 3. Create snapshots
  const snapEntries = activeIngredients.map((ing) => {
    const cs = ing.cost_state;
    return {
      restaurant_id: restaurantId,
      ingredient_id: ing.id,
      baseline_version: 1,
      ingredient_name_at_time: ing.name,
      supplier_name_at_time: ing.supplier_name,
      ingredient_type_at_time: ing.type,
      total_cost: ing.total_cost != null ? Number(ing.total_cost) : null,
      quantity: ing.original_quantity != null ? Number(ing.original_quantity) : null,
      uom_code: ing.original_uom_code,
      unit_cost: cs?.original_unit_cost != null ? Number(cs.original_unit_cost) : null,
      recipe_unit_cost: cs?.recipe_unit_cost != null ? Number(cs.recipe_unit_cost) : null,
      calculation_status: cs?.calculation_status ?? "pending",
    };
  });

  const { error: snapErr } = await supabase
    .from("ingredient_snapshots")
    .insert(snapEntries);
  if (snapErr) throw toApiError(snapErr);

  return { batch_id: batchId, entries_created: activeIngredients.length };
}
