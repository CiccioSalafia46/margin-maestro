// Price Log + Snapshot API — Build 1.5.
// All calls go through the browser Supabase client; RLS enforces tenant scoping.

import { supabase } from "./supabaseClient";
import { calculateCostState, getIngredients, upsertIngredientCostState } from "./ingredientsApi";
import type {
  ApiError,
  IngredientPriceLogRow,
  IngredientRow,
  IngredientSnapshotRow,
  PriceChangeInput,
  PriceChangePreview,
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

// ── Price Update Batch Flow (Build 1.5A) ─────────────────────────────

export function previewPriceChanges(
  changes: PriceChangeInput[],
  ingredients: Awaited<ReturnType<typeof getIngredients>>,
): PriceChangePreview[] {
  return changes.map((ch) => {
    const ing = ingredients.find((i) => i.id === ch.ingredient_id);
    if (!ing) {
      return { ingredient_id: ch.ingredient_id, ingredient_name: "Unknown", ingredient_type: "primary", supplier_name: null, old_recipe_unit_cost: null, new_recipe_unit_cost: null, delta_amount: null, delta_percent: null, status: "error" as const, error: "Ingredient not found." };
    }

    if (ing.type === "intermediate") {
      return { ingredient_id: ing.id, ingredient_name: ing.name, ingredient_type: ing.type, supplier_name: ing.supplier_name, old_recipe_unit_cost: ing.cost_state?.recipe_unit_cost != null ? Number(ing.cost_state.recipe_unit_cost) : null, new_recipe_unit_cost: null, delta_amount: null, delta_percent: null, status: "error" as const, error: "Intermediate costs are updated through recipes, not supplier price batches." };
    }

    // Build a virtual updated ingredient for cost calculation
    const virtual: IngredientRow = {
      ...ing,
      total_cost: ch.new_total_cost ?? ing.total_cost,
      original_quantity: ch.new_original_quantity ?? ing.original_quantity,
      original_uom_code: ch.new_original_uom_code ?? ing.original_uom_code,
      recipe_uom_code: ch.new_recipe_uom_code ?? ing.recipe_uom_code,
      adjustment: ch.new_adjustment ?? Number(ing.adjustment),
      density_g_per_ml: ch.new_density_g_per_ml ?? ing.density_g_per_ml,
      manual_recipe_unit_cost: ch.new_manual_recipe_unit_cost ?? ing.manual_recipe_unit_cost,
    };

    const newState = calculateCostState(virtual);
    const oldRuc = ing.cost_state?.recipe_unit_cost != null ? Number(ing.cost_state.recipe_unit_cost) : null;
    const newRuc = newState.recipe_unit_cost != null ? Number(newState.recipe_unit_cost) : null;

    if (newState.calculation_status === "error") {
      return { ingredient_id: ing.id, ingredient_name: ing.name, ingredient_type: ing.type, supplier_name: ing.supplier_name, old_recipe_unit_cost: oldRuc, new_recipe_unit_cost: null, delta_amount: null, delta_percent: null, status: "error" as const, error: newState.calculation_error };
    }

    if (oldRuc != null && newRuc != null && oldRuc === newRuc) {
      return { ingredient_id: ing.id, ingredient_name: ing.name, ingredient_type: ing.type, supplier_name: ing.supplier_name, old_recipe_unit_cost: oldRuc, new_recipe_unit_cost: newRuc, delta_amount: 0, delta_percent: 0, status: "unchanged" as const, error: null };
    }

    const deltaAmt = oldRuc != null && newRuc != null ? newRuc - oldRuc : null;
    const deltaPct = oldRuc != null && oldRuc !== 0 && deltaAmt != null ? deltaAmt / oldRuc : null;

    return { ingredient_id: ing.id, ingredient_name: ing.name, ingredient_type: ing.type, supplier_name: ing.supplier_name, old_recipe_unit_cost: oldRuc, new_recipe_unit_cost: newRuc, delta_amount: deltaAmt, delta_percent: deltaPct, status: "valid" as const, error: null };
  });
}

export async function applyPriceUpdateBatch(
  restaurantId: string,
  userId: string,
  changes: PriceChangeInput[],
  note?: string,
): Promise<{ batch_id: string; applied_count: number }> {
  const ingredients = await getIngredients(restaurantId);
  const previews = previewPriceChanges(changes, ingredients);

  const valid = previews.filter((p) => p.status === "valid");
  if (valid.length === 0) {
    throw { code: "validation", message: "No valid price changes to apply." } as ApiError;
  }

  // Get current baseline version
  const status = await getSnapshotStatus(restaurantId);
  const baselineVersion = status.baseline_version;

  // 1. Create batch
  const { data: batch, error: batchErr } = await supabase
    .from("price_update_batches")
    .insert({
      restaurant_id: restaurantId,
      created_by: userId,
      status: "applied",
      source: "manual",
      note: note || `Price update: ${valid.length} ingredient(s)`,
      baseline_version: baselineVersion,
      applied_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (batchErr) throw toApiError(batchErr);
  const batchId = (batch as unknown as PriceUpdateBatchRow).id;

  // 2. For each valid change: update ingredient, cost_state, log, snapshot
  for (const preview of valid) {
    const ch = changes.find((c) => c.ingredient_id === preview.ingredient_id)!;
    const ing = ingredients.find((i) => i.id === preview.ingredient_id)!;
    const oldCs = ing.cost_state;

    // Update ingredient source fields
    const patch: Record<string, unknown> = {};
    if (ch.new_total_cost != null) patch.total_cost = ch.new_total_cost;
    if (ch.new_original_quantity != null) patch.original_quantity = ch.new_original_quantity;
    if (ch.new_original_uom_code != null) patch.original_uom_code = ch.new_original_uom_code;
    if (ch.new_recipe_uom_code != null) patch.recipe_uom_code = ch.new_recipe_uom_code;
    if (ch.new_adjustment != null) patch.adjustment = ch.new_adjustment;
    if (ch.new_density_g_per_ml !== undefined) patch.density_g_per_ml = ch.new_density_g_per_ml;
    if (ch.new_manual_recipe_unit_cost !== undefined) patch.manual_recipe_unit_cost = ch.new_manual_recipe_unit_cost;

    if (Object.keys(patch).length > 0) {
      await supabase.from("ingredients").update(patch as Record<string, unknown> as { name?: string }).eq("id", ing.id).eq("restaurant_id", restaurantId);
    }

    // Recalculate and upsert cost state
    const virtualIng: IngredientRow = { ...ing, ...patch } as unknown as IngredientRow;
    const newState = calculateCostState(virtualIng);
    await upsertIngredientCostState(restaurantId, ing.id, newState);

    // Insert price log entry
    await supabase.from("ingredient_price_log").insert({
      restaurant_id: restaurantId,
      batch_id: batchId,
      ingredient_id: ing.id,
      baseline_version: baselineVersion,
      ingredient_name_at_time: ing.name,
      supplier_name_at_time: ing.supplier_name,
      ingredient_type_at_time: ing.type,
      old_total_cost: ing.total_cost != null ? Number(ing.total_cost) : null,
      old_quantity: ing.original_quantity != null ? Number(ing.original_quantity) : null,
      old_uom_code: ing.original_uom_code,
      old_unit_cost: oldCs?.original_unit_cost != null ? Number(oldCs.original_unit_cost) : null,
      old_recipe_unit_cost: oldCs?.recipe_unit_cost != null ? Number(oldCs.recipe_unit_cost) : null,
      new_total_cost: ch.new_total_cost ?? (ing.total_cost != null ? Number(ing.total_cost) : null),
      new_quantity: ch.new_original_quantity ?? (ing.original_quantity != null ? Number(ing.original_quantity) : null),
      new_uom_code: ch.new_original_uom_code ?? ing.original_uom_code,
      new_unit_cost: newState.original_unit_cost,
      new_recipe_unit_cost: newState.recipe_unit_cost,
      delta_recipe_unit_cost_amount: preview.delta_amount,
      delta_recipe_unit_cost_percent: preview.delta_percent,
      event_type: "change",
      note: note || null,
      created_by: userId,
    });

    // Update snapshot for current baseline version
    await supabase.from("ingredient_snapshots").upsert({
      restaurant_id: restaurantId,
      ingredient_id: ing.id,
      baseline_version: baselineVersion,
      ingredient_name_at_time: ing.name,
      supplier_name_at_time: ing.supplier_name,
      ingredient_type_at_time: ing.type,
      total_cost: ch.new_total_cost ?? (ing.total_cost != null ? Number(ing.total_cost) : null),
      quantity: ch.new_original_quantity ?? (ing.original_quantity != null ? Number(ing.original_quantity) : null),
      uom_code: ch.new_original_uom_code ?? ing.original_uom_code,
      unit_cost: newState.original_unit_cost,
      recipe_unit_cost: newState.recipe_unit_cost,
      calculation_status: newState.calculation_status,
    }, { onConflict: "restaurant_id,ingredient_id,baseline_version" });
  }

  return { batch_id: batchId, applied_count: valid.length };
}
