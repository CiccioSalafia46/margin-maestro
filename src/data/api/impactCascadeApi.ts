// Impact Cascade API — Build 1.7.
// All calls go through the browser Supabase client; RLS enforces tenant scoping.

import { supabase } from "./supabaseClient";
import { getIngredients } from "./ingredientsApi";
import { getPriceLogEntries, getSnapshotStatus } from "./priceLogApi";
import { getRecipes, calculateRecipeMetrics } from "./recipesApi";
import { getRestaurantSettings } from "./settingsApi";
import type {
  ApiError,
  ImpactCascadeItemRow,
  ImpactCascadeRunRow,
  IngredientPriceLogRow,
  IngredientWithCostState,
  RecipeWithLines,
} from "./types";
import { computeGP, computeGPM, isOnTarget, suggestedMenuPrice } from "@/lib/margin";
import { convertQuantity } from "@/lib/units";
import type { UoM } from "@/lib/types";

function toApiError(e: unknown): ApiError {
  const raw = typeof e === "object" && e !== null && "message" in e ? String((e as { message?: unknown }).message ?? "") : String(e ?? "");
  const code = (e as { code?: string } | null)?.code;
  if (raw.includes("not authenticated")) return { code: "auth", message: "Please sign in again." };
  if (code === "23505" || /duplicate key/i.test(raw)) return { code: "duplicate", message: "Impact cascade already generated for this batch." };
  if (code === "42501" || /permission denied|row-level security/i.test(raw)) return { code: "permission", message: "You don't have permission." };
  return { code: "unknown", message: raw || "Something went wrong." };
}

// ── Queries ──────────────────────────────────────────────────────────

export async function getImpactCascadeRuns(restaurantId: string): Promise<ImpactCascadeRunRow[]> {
  const { data, error } = await supabase.from("impact_cascade_runs").select("*").eq("restaurant_id", restaurantId).order("generated_at", { ascending: false });
  if (error) throw toApiError(error);
  return (data ?? []) as unknown as ImpactCascadeRunRow[];
}

export async function getImpactCascadeItems(restaurantId: string, runId: string): Promise<ImpactCascadeItemRow[]> {
  const { data, error } = await supabase.from("impact_cascade_items").select("*").eq("restaurant_id", restaurantId).eq("run_id", runId).order("gpm_delta", { ascending: true });
  if (error) throw toApiError(error);
  return (data ?? []) as unknown as ImpactCascadeItemRow[];
}

export async function getImpactCascadeForBatch(restaurantId: string, batchId: string): Promise<{ run: ImpactCascadeRunRow | null; items: ImpactCascadeItemRow[] }> {
  const { data: runData } = await supabase.from("impact_cascade_runs").select("*").eq("restaurant_id", restaurantId).eq("batch_id", batchId).maybeSingle();
  const run = runData as unknown as ImpactCascadeRunRow | null;
  if (!run) return { run: null, items: [] };
  const items = await getImpactCascadeItems(restaurantId, run.id);
  return { run, items };
}

// ── Generation ───────────────────────────────────────────────────────

function computeLineCogs(
  lines: RecipeWithLines["lines"],
  ingredients: IngredientWithCostState[],
  costOverrides: Map<string, number>,
  servQty: number,
): number {
  let total = 0;
  for (const line of lines) {
    const ing = ingredients.find((i) => i.id === line.ingredient_id);
    if (!ing) continue;
    const ruc = costOverrides.get(ing.id) ?? (ing.cost_state?.recipe_unit_cost != null ? Number(ing.cost_state.recipe_unit_cost) : 0);
    let qty = Number(line.quantity);
    const lineUom = line.uom_code as UoM;
    const ingUom = (ing.recipe_uom_code ?? line.uom_code) as UoM;
    if (lineUom !== ingUom) {
      const conv = convertQuantity(qty, lineUom, ingUom, ing.density_g_per_ml ?? undefined);
      qty = conv.ok ? conv.value : 0;
    }
    total += qty * ruc;
  }
  return servQty > 0 ? total / servQty : 0;
}

export async function generateImpactCascadeForBatch(
  restaurantId: string,
  batchId: string,
  userId: string,
): Promise<{ run_id: string; item_count: number }> {
  // Check if already exists
  const existing = await getImpactCascadeForBatch(restaurantId, batchId);
  if (existing.run) throw { code: "duplicate", message: "Impact cascade already generated for this batch." } as ApiError;

  const [allLog, recipes, ingredients, settings, snapStatus] = await Promise.all([
    getPriceLogEntries(restaurantId),
    getRecipes(restaurantId),
    getIngredients(restaurantId),
    getRestaurantSettings(restaurantId),
    getSnapshotStatus(restaurantId),
  ]);

  const targetGpm = settings?.target_gpm ?? 0.78;
  const baselineVersion = snapStatus.baseline_version;

  // Changed ingredients from this batch
  const batchLogRows = allLog.filter((e) => e.batch_id === batchId && e.event_type === "change");
  if (batchLogRows.length === 0) throw { code: "validation", message: "No price changes found in this batch." } as ApiError;

  // Build old/new cost override maps
  const oldCostMap = new Map<string, number>();
  const newCostMap = new Map<string, number>();
  const changedIngIds = new Set<string>();

  for (const row of batchLogRows) {
    if (!row.ingredient_id) continue;
    changedIngIds.add(row.ingredient_id);
    if (row.old_recipe_unit_cost != null) oldCostMap.set(row.ingredient_id, Number(row.old_recipe_unit_cost));
    if (row.new_recipe_unit_cost != null) newCostMap.set(row.ingredient_id, Number(row.new_recipe_unit_cost));
  }

  // Find affected dish recipes
  const dishRecipes = recipes.filter((r) => r.kind === "dish" && r.is_active);
  const items: Omit<ImpactCascadeItemRow, "id" | "created_at">[] = [];

  for (const dish of dishRecipes) {
    const lineIngIds = dish.lines.map((l) => l.ingredient_id);
    const directlyAffected = lineIngIds.filter((id) => changedIngIds.has(id));

    // Check indirect through intermediates
    const indirectlyAffected: string[] = [];
    for (const lineIngId of lineIngIds) {
      const ing = ingredients.find((i) => i.id === lineIngId);
      if (ing?.type === "intermediate") {
        const producer = recipes.find((r) => r.kind === "intermediate" && r.linked_intermediate_ingredient_id === lineIngId && r.is_active);
        if (producer) {
          const producerIngIds = producer.lines.map((l) => l.ingredient_id);
          if (producerIngIds.some((id) => changedIngIds.has(id))) {
            indirectlyAffected.push(lineIngId);
          }
        }
      }
    }

    const allAffected = [...new Set([...directlyAffected, ...indirectlyAffected])];
    if (allAffected.length === 0) continue;

    const affectedNames = allAffected.map((id) => ingredients.find((i) => i.id === id)?.name ?? "Unknown");

    // Build paths
    const paths = allAffected.map((id) => {
      const ing = ingredients.find((i) => i.id === id);
      if (directlyAffected.includes(id)) return { ingredient: ing?.name ?? "Unknown", path: `${ing?.name} → ${dish.name}`, type: "direct" };
      const producer = recipes.find((r) => r.kind === "intermediate" && r.linked_intermediate_ingredient_id === id && r.is_active);
      return { ingredient: ing?.name ?? "Unknown", path: `... → ${producer?.name ?? "?"} → ${ing?.name} → ${dish.name}`, type: "indirect" };
    });

    // Calculate old and new COGS per serving
    const servQty = Number(dish.serving_quantity);
    const oldCogsPerServing = computeLineCogs(dish.lines, ingredients, oldCostMap, servQty);
    const newCogsPerServing = computeLineCogs(dish.lines, ingredients, newCostMap, servQty);
    const cogsDelta = newCogsPerServing - oldCogsPerServing;

    const mp = dish.menu_price != null ? Number(dish.menu_price) : null;
    const oldGp = mp != null && mp > 0 ? computeGP(mp, oldCogsPerServing) : null;
    const newGp = mp != null && mp > 0 ? computeGP(mp, newCogsPerServing) : null;
    const oldGpm = mp != null && mp > 0 ? computeGPM(mp, oldCogsPerServing) : null;
    const newGpm = mp != null && mp > 0 ? computeGPM(mp, newCogsPerServing) : null;
    const wasOnTarget = oldGpm != null ? isOnTarget(oldGpm, targetGpm) : null;
    const isOnTgt = newGpm != null ? isOnTarget(newGpm, targetGpm) : null;
    const newlyBelow = wasOnTarget === true && isOnTgt === false;
    const suggested = suggestedMenuPrice(newCogsPerServing, targetGpm);

    items.push({
      restaurant_id: restaurantId,
      run_id: "", // filled after run creation
      batch_id: batchId,
      dish_recipe_id: dish.id,
      dish_name_at_time: dish.name,
      category_name_at_time: dish.category_name,
      affected_ingredient_ids: allAffected,
      affected_ingredient_names: affectedNames,
      impact_paths: paths,
      menu_price: mp,
      target_gpm: targetGpm,
      old_cogs_per_serving: oldCogsPerServing,
      new_cogs_per_serving: newCogsPerServing,
      cogs_delta_per_serving: cogsDelta,
      old_gp: oldGp,
      new_gp: newGp,
      gp_delta: oldGp != null && newGp != null ? newGp - oldGp : null,
      old_gpm: oldGpm,
      new_gpm: newGpm,
      gpm_delta: oldGpm != null && newGpm != null ? newGpm - oldGpm : null,
      was_on_target: wasOnTarget,
      is_on_target: isOnTgt,
      newly_below_target: newlyBelow,
      suggested_menu_price: suggested,
      suggested_price_delta: suggested != null && mp != null ? suggested - mp : null,
      calculation_status: mp == null || mp <= 0 ? "incomplete" : "valid",
      issue_summary: mp == null || mp <= 0 ? "Menu price not set" : null,
    });
  }

  const totalCogsDelta = items.reduce((s, i) => s + (i.cogs_delta_per_serving ?? 0), 0);
  const totalMarginDelta = items.reduce((s, i) => s + (i.gp_delta ?? 0), 0);

  // Create run
  const { data: runData, error: runErr } = await supabase.from("impact_cascade_runs").insert({
    restaurant_id: restaurantId,
    batch_id: batchId,
    baseline_version: baselineVersion,
    status: "generated",
    generated_by: userId,
    changed_ingredients_count: changedIngIds.size,
    affected_dish_count: items.length,
    impact_item_count: items.length,
    newly_below_target_count: items.filter((i) => i.newly_below_target).length,
    total_cogs_delta_per_serving: totalCogsDelta,
    total_margin_delta_per_serving: totalMarginDelta,
    note: `Impact cascade for ${changedIngIds.size} changed ingredient(s) across ${items.length} dish(es).`,
  }).select("id").single();
  if (runErr) throw toApiError(runErr);
  const runId = (runData as { id: string }).id;

  // Insert items
  if (items.length > 0) {
    const { error: itemsErr } = await supabase.from("impact_cascade_items").insert(
      items.map((i) => ({ ...i, run_id: runId })),
    );
    if (itemsErr) throw toApiError(itemsErr);
  }

  return { run_id: runId, item_count: items.length };
}
