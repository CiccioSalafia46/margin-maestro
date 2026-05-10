// Recipe CSV Import API — Build 3.0.
// Two-file CSV import for recipes (header) + recipe lines.
// Browser-only client + RLS. No service-role usage. No batches, no
// ingredient_price_log writes, no billing rows. May write to
// menu_price_audit_log (Build 2.9) when imported dish menu_price changes.

import { parseCsv, normalizeCsvHeader, coerceNumber, coerceBoolean, validateRequiredColumns, downloadCsv } from "@/lib/csv";
import { supabase } from "./supabaseClient";
import {
  getRecipes,
  createRecipe,
  updateRecipe,
  replaceRecipeLines,
  detectCycle,
} from "./recipesApi";
import { getIngredients } from "./ingredientsApi";
import { getMenuCategories } from "./settingsApi";
import { createMenuPriceAuditEntry } from "./menuPriceAuditApi";
import type {
  ApiError,
  IngredientWithCostState,
  RecipeImportApplyResult,
  RecipeImportLineRow,
  RecipeImportOptions,
  RecipeImportPreview,
  RecipeImportRecipeRow,
  RecipeImportStatus,
  RecipeInput,
  RecipeLineInput,
  RecipeWithLines,
  RestaurantRole,
} from "./types";

// ── Constants ────────────────────────────────────────────────────────

const RECIPE_REQUIRED = ["name", "kind"];
const LINE_REQUIRED = ["recipe_name", "ingredient_name", "quantity", "uom_code"];
const VALID_KINDS = new Set(["dish", "intermediate"]);
const VALID_UOMS = new Set(["Ct", "Gr", "Kg", "Lb", "Oz", "Ml", "Lt", "Gl"]);

const RECIPE_COLUMNS = [
  "name", "kind", "category_name", "serving_quantity", "serving_uom_code",
  "menu_price", "target_gpm", "linked_intermediate_ingredient_name", "notes", "is_active",
];
const LINE_COLUMNS = [
  "recipe_name", "ingredient_name", "quantity", "uom_code", "notes", "line_order",
];

// ── Helpers ──────────────────────────────────────────────────────────

function toApiError(e: unknown): ApiError {
  const raw =
    typeof e === "object" && e !== null && "message" in e
      ? String((e as { message?: unknown }).message ?? "")
      : String(e ?? "");
  const code = (e as { code?: string } | null)?.code;
  if (raw.includes("not authenticated"))
    return { code: "auth", message: "Please sign in again." };
  if (code === "42501" || /permission denied|row-level security/i.test(raw))
    return { code: "permission", message: "You don't have permission." };
  return { code: "unknown", message: raw || "Something went wrong." };
}

export function canImportRecipes(role: RestaurantRole | null): boolean {
  return role === "owner" || role === "manager";
}

// ── Templates ────────────────────────────────────────────────────────

export function getRecipeImportTemplate(): string {
  return RECIPE_COLUMNS.join(",") + "\n";
}

export function getRecipeLinesImportTemplate(): string {
  return LINE_COLUMNS.join(",") + "\n";
}

export function downloadRecipeImportTemplate(): void {
  downloadCsv("recipes-import-template.csv", [], RECIPE_COLUMNS.map((k) => ({ key: k, label: k })));
}

export function downloadRecipeLinesImportTemplate(): void {
  downloadCsv("recipe-lines-import-template.csv", [], LINE_COLUMNS.map((k) => ({ key: k, label: k })));
}

// ── Exports ──────────────────────────────────────────────────────────

export async function exportRecipeLinesCsv(restaurantId: string): Promise<void> {
  const recipes = await getRecipes(restaurantId);
  const ingredients = await getIngredients(restaurantId);
  const ingById = new Map(ingredients.map((i) => [i.id, i.name]));
  const rows: Record<string, unknown>[] = [];
  for (const r of recipes) {
    if (!r.is_active) continue;
    for (const l of r.lines) {
      rows.push({
        recipe_name: r.name,
        ingredient_name: ingById.get(l.ingredient_id) ?? "",
        quantity: l.quantity,
        uom_code: l.uom_code,
        notes: l.notes ?? "",
        line_order: l.sort_order ?? "",
      });
    }
  }
  downloadCsv(
    "recipe-lines.csv",
    rows,
    LINE_COLUMNS.map((k) => ({ key: k, label: k })),
  );
}

// ── Parsers ──────────────────────────────────────────────────────────

function parseGenericCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const raw = parseCsv(text);
  if (raw.length < 2) return { headers: raw.length === 1 ? raw[0].map(normalizeCsvHeader) : [], rows: [] };
  const headers = raw[0].map(normalizeCsvHeader);
  const rows = raw.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
    return row;
  });
  return { headers, rows };
}

export function parseRecipeCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  return parseGenericCsv(text);
}

export function parseRecipeLinesCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  return parseGenericCsv(text);
}

// ── Validation ───────────────────────────────────────────────────────

interface RecipeValidationContext {
  existing_recipes: RecipeWithLines[];
  existing_categories: { id: string; name: string }[];
  existing_intermediate_ingredients: IngredientWithCostState[];
  duplicate_mode: RecipeImportOptions["duplicate_mode"];
}

interface LineValidationContext {
  preview_recipe_names: Set<string>;
  existing_recipes_by_name: Map<string, RecipeWithLines>;
  existing_ingredients_by_name: Map<string, IngredientWithCostState>;
}

export function validateRecipeImportRows(
  rows: Record<string, string>[],
  context: RecipeValidationContext,
): RecipeImportRecipeRow[] {
  const existingByName = new Map(
    context.existing_recipes
      .filter((r) => r.is_active)
      .map((r) => [r.name.trim().toLowerCase(), r]),
  );
  const categoryByName = new Map(
    context.existing_categories.map((c) => [c.name.trim().toLowerCase(), c]),
  );
  const intermediateByName = new Map(
    context.existing_intermediate_ingredients
      .filter((i) => i.is_active && i.type === "intermediate")
      .map((i) => [i.name.trim().toLowerCase(), i]),
  );

  const seenInCsv = new Set<string>();

  return rows.map((data, idx): RecipeImportRecipeRow => {
    const messages: string[] = [];
    let status: RecipeImportStatus = "valid";

    const name = (data.name ?? "").trim();
    const kind = (data.kind ?? "").trim().toLowerCase();
    const categoryName = (data.category_name ?? "").trim();
    const linkedIngName = (data.linked_intermediate_ingredient_name ?? "").trim();

    // A. Required fields.
    if (!name) {
      messages.push("name is required.");
      status = "error";
    }
    if (!kind) {
      messages.push("kind is required.");
      status = "error";
    } else if (!VALID_KINDS.has(kind)) {
      messages.push(`Invalid kind "${data.kind}" — must be "dish" or "intermediate".`);
      status = "error";
    }

    // B. Duplicates within the CSV.
    if (name) {
      const k = name.toLowerCase();
      if (seenInCsv.has(k)) {
        messages.push("Duplicate recipe name in CSV.");
        status = "error";
      }
      seenInCsv.add(k);
    }

    // C. Numeric fields.
    const servingQuantity = coerceNumber(data.serving_quantity);
    if (data.serving_quantity && data.serving_quantity.trim() !== "" && (servingQuantity == null || servingQuantity <= 0)) {
      messages.push("serving_quantity must be greater than 0 if provided.");
      status = "error";
    }
    const menuPrice = coerceNumber(data.menu_price);
    if (data.menu_price && data.menu_price.trim() !== "" && (menuPrice == null || menuPrice <= 0)) {
      messages.push("menu_price must be greater than 0 if provided.");
      status = "error";
    }
    const targetGpm = coerceNumber(data.target_gpm);
    if (data.target_gpm && data.target_gpm.trim() !== "" && (targetGpm == null || targetGpm < 0 || targetGpm > 1)) {
      messages.push("target_gpm must be between 0 and 1 if provided. (Stored at the restaurant level — not per-recipe — so this column is informational only.)");
      if (status === "valid") status = "warning";
    } else if (data.target_gpm && data.target_gpm.trim() !== "") {
      messages.push("target_gpm is informational only — Margin IQ stores target_gpm per restaurant, not per recipe.");
      if (status === "valid") status = "warning";
    }

    // D. UoM.
    const servingUom = (data.serving_uom_code ?? "").trim();
    if (servingUom && !VALID_UOMS.has(servingUom)) {
      messages.push(`Invalid serving_uom_code "${servingUom}".`);
      status = "error";
    }

    // E. Kind-specific rules.
    if (kind === "intermediate" && menuPrice != null) {
      messages.push("menu_price ignored for intermediate recipes.");
      if (status === "valid") status = "warning";
    }

    // F. Category resolution.
    let resolvedCategoryId: string | null = null;
    if (categoryName) {
      const cat = categoryByName.get(categoryName.toLowerCase());
      if (cat) resolvedCategoryId = cat.id;
      else {
        messages.push(`Category "${categoryName}" not found — will be left blank. Categories are NOT created automatically by recipe import.`);
        if (status === "valid") status = "warning";
      }
    }

    // G. Linked intermediate ingredient resolution.
    let resolvedLinkedId: string | null = null;
    if (linkedIngName) {
      if (kind !== "intermediate") {
        messages.push("linked_intermediate_ingredient_name only applies to intermediate recipes.");
        if (status === "valid") status = "warning";
      } else {
        const ing = intermediateByName.get(linkedIngName.toLowerCase());
        if (ing) resolvedLinkedId = ing.id;
        else {
          messages.push(`Intermediate ingredient "${linkedIngName}" not found among active intermediate ingredients. Recipe import does NOT create ingredients.`);
          if (status === "valid") status = "warning";
        }
      }
    }

    // H. Duplicate handling.
    let action: RecipeImportRecipeRow["action"] = "create";
    let existingId: string | null = null;
    let existingKind: string | null = null;
    let oldMenuPrice: number | null = null;
    if (name) {
      const ex = existingByName.get(name.toLowerCase());
      if (ex) {
        existingId = ex.id;
        existingKind = ex.kind;
        oldMenuPrice = ex.menu_price ?? null;
        if (context.duplicate_mode === "block") {
          messages.push(`Recipe "${ex.name}" already exists — blocked by duplicate mode.`);
          status = "error";
          action = "skip";
        } else if (context.duplicate_mode === "skip") {
          messages.push(`Recipe "${ex.name}" already exists — skipping.`);
          if (status !== "error") status = "skipped";
          action = "skip";
        } else if (context.duplicate_mode === "update") {
          if (kind && existingKind && kind !== existingKind) {
            messages.push(`Cannot change kind of existing recipe "${ex.name}" from ${existingKind} to ${kind}.`);
            status = "error";
            action = "skip";
          } else {
            action = "update";
          }
        }
      }
    }

    return {
      row_number: idx + 2,
      data,
      status,
      action,
      messages,
      existing_id: existingId,
      existing_kind: existingKind,
      resolved_category_id: resolvedCategoryId,
      resolved_linked_ingredient_id: resolvedLinkedId,
      old_menu_price: oldMenuPrice,
    };
  });
}

export function validateRecipeLineImportRows(
  rows: Record<string, string>[],
  context: LineValidationContext,
): RecipeImportLineRow[] {
  return rows.map((data, idx): RecipeImportLineRow => {
    const messages: string[] = [];
    let status: RecipeImportStatus = "valid";

    const recipeName = (data.recipe_name ?? "").trim();
    const ingredientName = (data.ingredient_name ?? "").trim();
    const quantity = coerceNumber(data.quantity);
    const uom = (data.uom_code ?? "").trim();

    if (!recipeName) {
      messages.push("recipe_name is required.");
      status = "error";
    }
    if (!ingredientName) {
      messages.push("ingredient_name is required.");
      status = "error";
    }
    if (quantity == null || quantity <= 0) {
      messages.push("quantity must be greater than 0.");
      status = "error";
    }
    if (!uom) {
      messages.push("uom_code is required.");
      status = "error";
    } else if (!VALID_UOMS.has(uom)) {
      messages.push(`Invalid uom_code "${uom}".`);
      status = "error";
    }

    const lcRecipe = recipeName.toLowerCase();
    const matchedInPreview = recipeName ? context.preview_recipe_names.has(lcRecipe) : false;
    const matchedExisting = recipeName ? context.existing_recipes_by_name.has(lcRecipe) : false;
    if (recipeName && !matchedInPreview && !matchedExisting) {
      messages.push(`Recipe "${recipeName}" not found in either the recipes CSV or existing recipes.`);
      status = "error";
    }

    let resolvedIngredientId: string | null = null;
    if (ingredientName) {
      const ing = context.existing_ingredients_by_name.get(ingredientName.toLowerCase());
      if (ing && ing.is_active) {
        resolvedIngredientId = ing.id;
      } else {
        messages.push(`Active ingredient "${ingredientName}" not found. Recipe import does NOT create ingredients.`);
        status = "error";
      }
    }

    return {
      row_number: idx + 2,
      data,
      status,
      messages,
      recipe_name: recipeName,
      matched_in_preview: matchedInPreview,
      matched_existing: matchedExisting,
      resolved_ingredient_id: resolvedIngredientId,
    };
  });
}

// ── Preview ──────────────────────────────────────────────────────────

export async function previewRecipeImport(
  restaurantId: string,
  recipesCsv: string,
  recipeLinesCsv: string,
  options: RecipeImportOptions,
): Promise<RecipeImportPreview> {
  const messages: string[] = [];

  const recipesParsed = parseRecipeCsv(recipesCsv);
  const linesParsed = parseRecipeLinesCsv(recipeLinesCsv);

  const recipesProvided = recipesCsv.trim().length > 0;
  const linesProvided = recipeLinesCsv.trim().length > 0;

  if (!recipesProvided && !linesProvided) {
    throw { code: "validation", message: "Provide at least one CSV file (recipes or recipe lines)." } as ApiError;
  }

  if (recipesProvided) {
    const missing = validateRequiredColumns(recipesParsed.headers, RECIPE_REQUIRED);
    if (missing.length > 0)
      throw { code: "validation", message: `Recipes CSV missing required columns: ${missing.join(", ")}` } as ApiError;
  }
  if (linesProvided) {
    const missing = validateRequiredColumns(linesParsed.headers, LINE_REQUIRED);
    if (missing.length > 0)
      throw { code: "validation", message: `Recipe Lines CSV missing required columns: ${missing.join(", ")}` } as ApiError;
  }

  const [existingRecipes, existingIngredients, existingCategories] = await Promise.all([
    getRecipes(restaurantId),
    getIngredients(restaurantId),
    getMenuCategories(restaurantId),
  ]);

  const recipeRows = validateRecipeImportRows(recipesParsed.rows, {
    existing_recipes: existingRecipes,
    existing_categories: existingCategories,
    existing_intermediate_ingredients: existingIngredients,
    duplicate_mode: options.duplicate_mode,
  });

  const previewRecipeNames = new Set(
    recipeRows
      .filter((r) => r.status !== "error" && r.status !== "skipped")
      .map((r) => (r.data.name ?? "").trim().toLowerCase())
      .filter(Boolean),
  );
  const existingRecipesByName = new Map(
    existingRecipes
      .filter((r) => r.is_active)
      .map((r) => [r.name.trim().toLowerCase(), r]),
  );
  const existingIngredientsByName = new Map(
    existingIngredients.map((i) => [i.name.trim().toLowerCase(), i]),
  );

  const lineRows = validateRecipeLineImportRows(linesParsed.rows, {
    preview_recipe_names: previewRecipeNames,
    existing_recipes_by_name: existingRecipesByName,
    existing_ingredients_by_name: existingIngredientsByName,
  });

  if (recipesProvided && recipeRows.length === 0) messages.push("Recipes CSV had no data rows.");
  if (linesProvided && lineRows.length === 0) messages.push("Recipe Lines CSV had no data rows.");

  const result: RecipeImportPreview = {
    total_recipes: recipeRows.length,
    total_lines: lineRows.length,
    valid_recipes: recipeRows.filter((r) => r.status === "valid").length,
    warning_recipes: recipeRows.filter((r) => r.status === "warning").length,
    error_recipes: recipeRows.filter((r) => r.status === "error").length,
    valid_lines: lineRows.filter((r) => r.status === "valid").length,
    warning_lines: lineRows.filter((r) => r.status === "warning").length,
    error_lines: lineRows.filter((r) => r.status === "error").length,
    creates: recipeRows.filter((r) => r.action === "create" && r.status !== "error").length,
    updates: recipeRows.filter((r) => r.action === "update" && r.status !== "error").length,
    skipped: recipeRows.filter((r) => r.status === "skipped").length,
    recipe_rows: recipeRows,
    line_rows: lineRows,
    messages,
  };

  return result;
}

// ── Apply ────────────────────────────────────────────────────────────

interface ApplyContext {
  existing_recipes: RecipeWithLines[];
  existing_ingredients: IngredientWithCostState[];
  recipes_by_name: Map<string, { id: string; kind: string }>;
}

function buildRecipeInputFromRow(row: RecipeImportRecipeRow): RecipeInput {
  const d = row.data;
  return {
    name: (d.name ?? "").trim(),
    kind: ((d.kind ?? "").trim().toLowerCase() as "dish" | "intermediate"),
    menu_category_id: row.resolved_category_id,
    serving_quantity: coerceNumber(d.serving_quantity) ?? 1,
    serving_uom_code: (d.serving_uom_code ?? "").trim() || "Ct",
    menu_price: coerceNumber(d.menu_price),
    linked_intermediate_ingredient_id: row.resolved_linked_ingredient_id,
    notes: (d.notes ?? "").trim() || null,
  };
}

export async function applyRecipeImport(
  restaurantId: string,
  preview: RecipeImportPreview,
  options: RecipeImportOptions,
): Promise<RecipeImportApplyResult> {
  if (preview.error_recipes > 0 || preview.error_lines > 0) {
    throw {
      code: "validation",
      message: "Preview contains errors. Resolve all errors before applying the import.",
    } as ApiError;
  }

  const result: RecipeImportApplyResult = {
    recipes_created: 0,
    recipes_updated: 0,
    recipes_skipped: 0,
    lines_inserted: 0,
    lines_replaced_for: 0,
    errors: [],
    audit_recorded: 0,
    audit_failed: 0,
  };

  // Phase 1 — Recipes (creates + updates).
  // Build a name → id map progressively to resolve recipe_name on lines.
  const [existingRecipes, existingIngredients] = await Promise.all([
    getRecipes(restaurantId),
    getIngredients(restaurantId),
  ]);

  const ctx: ApplyContext = {
    existing_recipes: existingRecipes,
    existing_ingredients: existingIngredients,
    recipes_by_name: new Map(
      existingRecipes.filter((r) => r.is_active).map((r) => [r.name.trim().toLowerCase(), { id: r.id, kind: r.kind }]),
    ),
  };

  for (const row of preview.recipe_rows) {
    if (row.status === "error") continue;
    if (row.status === "skipped" || row.action === "skip") {
      result.recipes_skipped++;
      continue;
    }

    try {
      const input = buildRecipeInputFromRow(row);
      if (row.action === "create") {
        const created = await createRecipe(restaurantId, input);
        ctx.recipes_by_name.set(created.name.trim().toLowerCase(), { id: created.id, kind: created.kind });
        result.recipes_created++;

        // Audit row for new dish menu_price.
        if (created.kind === "dish" && created.menu_price != null && created.menu_price > 0) {
          try {
            await createMenuPriceAuditEntry({
              restaurant_id: restaurantId,
              recipe_id: created.id,
              recipe_name_at_time: created.name,
              old_menu_price: null,
              new_menu_price: created.menu_price,
              source: "import",
              context: { origin: "recipe-csv-import", action: "create", row_number: row.row_number },
            });
            result.audit_recorded++;
          } catch {
            result.audit_failed++;
          }
        }
      } else if (row.action === "update" && row.existing_id) {
        // Build 3.4: when a dish menu_price actually changes, do the price
        // update + audit via the atomic RPC (source='import'). Other recipe
        // fields are still patched via updateRecipe — non-atomic with the
        // price update but this is by design (no recipe-wide RPC in 3.4).
        const isDishPriceChange =
          row.existing_kind === "dish" &&
          input.menu_price != null &&
          input.menu_price > 0 &&
          input.menu_price !== row.old_menu_price;

        const patchForUpdateRecipe = isDishPriceChange
          ? { ...input, menu_price: undefined as unknown as number | null }
          : input;

        const updated = await updateRecipe(restaurantId, row.existing_id, patchForUpdateRecipe);
        ctx.recipes_by_name.set(updated.name.trim().toLowerCase(), { id: updated.id, kind: updated.kind });
        result.recipes_updated++;

        if (isDishPriceChange) {
          try {
            const { data, error } = await supabase.rpc("apply_dish_menu_price_with_audit", {
              p_restaurant_id: restaurantId,
              p_recipe_id: updated.id,
              p_new_menu_price: input.menu_price as number,
              p_source: "import",
              p_note: null,
              p_context: { origin: "recipe-csv-import", action: "update", row_number: row.row_number } as never,
            });
            if (error) throw error;
            const audit = Array.isArray(data) ? data[0] : data;
            if (audit) result.audit_recorded++;
            else result.audit_failed++;
          } catch (e) {
            // RPC failed — price change for this dish did not happen.
            result.audit_failed++;
            const msg = e instanceof Error ? e.message : "atomic price update failed";
            result.errors.push(`Row ${row.row_number}: ${msg}`);
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "recipe failed";
      result.errors.push(`Row ${row.row_number}: ${msg}`);
    }
  }

  // Phase 2 — Recipe lines, grouped by recipe.
  if (preview.line_rows.length > 0) {
    // Group valid line rows by recipe_name (case-insensitive).
    const grouped = new Map<string, RecipeImportLineRow[]>();
    for (const lr of preview.line_rows) {
      if (lr.status === "error") continue;
      const k = lr.recipe_name.trim().toLowerCase();
      if (!k) continue;
      const list = grouped.get(k) ?? [];
      list.push(lr);
      grouped.set(k, list);
    }

    // Re-fetch existing recipes (with lines) to get current line state for append.
    const refreshed = await getRecipes(restaurantId);
    const refreshedByName = new Map(
      refreshed.filter((r) => r.is_active).map((r) => [r.name.trim().toLowerCase(), r]),
    );

    for (const [recipeKey, rows] of grouped.entries()) {
      const target = refreshedByName.get(recipeKey) ?? null;
      if (!target) {
        result.errors.push(`Lines: recipe "${rows[0].recipe_name}" not found after Phase 1.`);
        continue;
      }

      const newLineInputs: RecipeLineInput[] = [];
      for (const lr of rows) {
        if (!lr.resolved_ingredient_id) continue;
        const q = coerceNumber(lr.data.quantity);
        if (q == null) continue;
        const order = coerceNumber(lr.data.line_order);
        const input: RecipeLineInput = {
          ingredient_id: lr.resolved_ingredient_id,
          quantity: q,
          uom_code: lr.data.uom_code.trim(),
          notes: (lr.data.notes ?? "").trim() || null,
        };
        if (order != null) input.sort_order = order;
        newLineInputs.push(input);
      }

      if (newLineInputs.length === 0) continue;

      // Cycle detection — best-effort using the projected post-import line set.
      const projectedIngredientIds =
        options.line_mode === "replace"
          ? newLineInputs.map((l) => l.ingredient_id)
          : [...target.lines.map((l) => l.ingredient_id), ...newLineInputs.map((l) => l.ingredient_id)];
      const cycleErr = detectCycle(target.id, projectedIngredientIds, refreshed, ctx.existing_ingredients);
      if (cycleErr) {
        result.errors.push(`Lines for "${target.name}" rejected: ${cycleErr}`);
        continue;
      }

      try {
        if (options.line_mode === "replace") {
          // Hard-deletes existing lines (existing safe RLS-bound operation).
          // The UI must warn before we get here.
          const inserted = await replaceRecipeLines(restaurantId, target.id, newLineInputs);
          result.lines_replaced_for++;
          result.lines_inserted += inserted.length;
        } else {
          // Append: insert new lines without touching existing ones.
          const baseOrder = target.lines.reduce((m, l) => Math.max(m, l.sort_order ?? 0), 0);
          const payload = newLineInputs.map((l, i) => ({
            restaurant_id: restaurantId,
            recipe_id: target.id,
            ingredient_id: l.ingredient_id,
            quantity: l.quantity,
            uom_code: l.uom_code,
            sort_order: l.sort_order ?? baseOrder + i + 1,
            notes: l.notes ?? null,
          }));
          const { data, error } = await supabase
            .from("recipe_lines")
            .insert(payload)
            .select("*");
          if (error) throw toApiError(error);
          result.lines_inserted += (data?.length ?? 0);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "lines failed";
        result.errors.push(`Lines for "${target.name}": ${msg}`);
      }
    }
  }

  return result;
}
