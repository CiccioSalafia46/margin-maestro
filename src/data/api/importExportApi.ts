// CSV Import/Export API — Build 2.5.

import { parseCsv, normalizeCsvHeader, downloadCsv, coerceNumber, coerceBoolean, validateRequiredColumns } from "@/lib/csv";
import { getIngredients, createIngredient, updateIngredient, calculateCostState, upsertIngredientCostState } from "./ingredientsApi";
import { getRecipes } from "./recipesApi";
import { getMenuAnalyticsData } from "./menuAnalyticsApi";
import { getPriceLogEntries } from "./priceLogApi";
import { getAlerts } from "./alertsApi";
import { getSuppliers } from "./settingsApi";
import type { ApiError, IngredientInput, IngredientType } from "./types";

// ── Templates ────────────────────────────────────────────────────────

export function getIngredientImportTemplate(): string {
  return "name,type,supplier_name,total_cost,original_quantity,original_uom_code,recipe_uom_code,adjustment,density_g_per_ml,manual_recipe_unit_cost,notes\n";
}

// ── Import ───────────────────────────────────────────────────────────

export interface ImportRow {
  row_number: number;
  data: Record<string, string>;
  status: "valid" | "warning" | "error" | "skipped";
  action: "create" | "update" | "skip";
  messages: string[];
  existing_id: string | null;
}

export interface ImportPreview {
  total: number;
  valid: number;
  warning: number;
  error: number;
  creates: number;
  updates: number;
  skips: number;
  rows: ImportRow[];
}

export function parseIngredientCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const raw = parseCsv(text);
  if (raw.length < 2) return { headers: [], rows: [] };
  const headers = raw[0].map(normalizeCsvHeader);
  const rows = raw.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
    return row;
  });
  return { headers, rows };
}

export async function previewIngredientImport(
  restaurantId: string,
  csvText: string,
  mode: "skip" | "update" = "skip",
): Promise<ImportPreview> {
  const { headers, rows } = parseIngredientCsv(csvText);
  const missing = validateRequiredColumns(headers, ["name", "type"]);
  if (missing.length > 0) throw { code: "validation", message: `Missing required columns: ${missing.join(", ")}` } as ApiError;

  const [existing, suppliers] = await Promise.all([
    getIngredients(restaurantId),
    getSuppliers(restaurantId),
  ]);
  const existingMap = new Map(existing.filter((i) => i.is_active).map((i) => [i.name.toLowerCase(), i]));
  const supplierMap = new Map(suppliers.filter((s) => s.is_active).map((s) => [s.name.toLowerCase(), s.id]));
  const validTypes = new Set(["primary", "intermediate", "fixed"]);
  const validUoms = new Set(["Ct", "Gr", "Kg", "Lb", "Oz", "Ml", "Lt", "Gl"]);

  const result: ImportRow[] = rows.map((data, idx) => {
    const msgs: string[] = [];
    let status: ImportRow["status"] = "valid";
    const name = data.name?.trim();
    const type = data.type?.trim().toLowerCase();

    if (!name) { msgs.push("Name is required."); status = "error"; }
    if (!type || !validTypes.has(type)) { msgs.push(`Invalid type: "${type}". Must be primary, fixed, or intermediate.`); status = "error"; }

    if (type === "primary") {
      if (coerceNumber(data.total_cost) == null) { msgs.push("Primary requires total_cost."); status = "error"; }
      if (coerceNumber(data.original_quantity) == null || (coerceNumber(data.original_quantity) ?? 0) <= 0) { msgs.push("Primary requires original_quantity > 0."); status = "error"; }
      if (data.original_uom_code && !validUoms.has(data.original_uom_code)) { msgs.push(`Invalid original_uom_code: "${data.original_uom_code}".`); status = "error"; }
      if (data.recipe_uom_code && !validUoms.has(data.recipe_uom_code)) { msgs.push(`Invalid recipe_uom_code: "${data.recipe_uom_code}".`); status = "error"; }
    }
    if (type === "fixed" && coerceNumber(data.manual_recipe_unit_cost) == null) { msgs.push("Fixed requires manual_recipe_unit_cost."); status = "error"; }

    const adj = coerceNumber(data.adjustment);
    if (adj != null && adj === -1) { msgs.push("Adjustment cannot be -1."); status = "error"; }

    if (data.supplier_name && !supplierMap.has(data.supplier_name.toLowerCase())) {
      msgs.push(`Supplier "${data.supplier_name}" not found — will be left blank.`);
      if (status === "valid") status = "warning";
    }

    const ex = name ? existingMap.get(name.toLowerCase()) : null;
    let action: ImportRow["action"] = "create";
    if (ex) {
      action = mode === "update" ? "update" : "skip";
      if (action === "skip") { msgs.push("Already exists — skipping."); status = "skipped"; }
    }

    return { row_number: idx + 2, data, status, action, messages: msgs, existing_id: ex?.id ?? null };
  });

  return {
    total: result.length,
    valid: result.filter((r) => r.status === "valid").length,
    warning: result.filter((r) => r.status === "warning").length,
    error: result.filter((r) => r.status === "error").length,
    creates: result.filter((r) => r.action === "create" && r.status !== "error").length,
    updates: result.filter((r) => r.action === "update" && r.status !== "error").length,
    skips: result.filter((r) => r.status === "skipped").length,
    rows: result,
  };
}

export async function applyIngredientImport(
  restaurantId: string,
  preview: ImportPreview,
): Promise<{ created: number; updated: number; errors: number }> {
  let created = 0, updated = 0, errors = 0;
  const suppliers = await getSuppliers(restaurantId);
  const supplierMap = new Map(suppliers.filter((s) => s.is_active).map((s) => [s.name.toLowerCase(), s.id]));

  for (const row of preview.rows) {
    if (row.status === "error" || row.status === "skipped") continue;
    const d = row.data;
    const type = d.type.toLowerCase() as IngredientType;
    const supplierId = d.supplier_name ? supplierMap.get(d.supplier_name.toLowerCase()) ?? null : null;

    const input: IngredientInput = {
      name: d.name.trim(),
      type,
      supplier_id: supplierId,
      total_cost: coerceNumber(d.total_cost),
      original_quantity: coerceNumber(d.original_quantity),
      original_uom_code: d.original_uom_code || null,
      recipe_uom_code: d.recipe_uom_code || null,
      adjustment: (coerceNumber(d.adjustment) ?? 0) / 100,
      density_g_per_ml: coerceNumber(d.density_g_per_ml),
      manual_recipe_unit_cost: coerceNumber(d.manual_recipe_unit_cost),
      notes: d.notes || null,
    };

    try {
      if (row.action === "update" && row.existing_id) {
        const updated_row = await updateIngredient(restaurantId, row.existing_id, input);
        const cs = calculateCostState(updated_row);
        await upsertIngredientCostState(restaurantId, row.existing_id, cs);
        updated++;
      } else {
        const created_row = await createIngredient(restaurantId, input);
        const cs = calculateCostState(created_row);
        await upsertIngredientCostState(restaurantId, created_row.id, cs);
        created++;
      }
    } catch { errors++; }
  }

  return { created, updated, errors };
}

// ── Exports ──────────────────────────────────────────────────────────

export async function exportIngredientsCsv(restaurantId: string): Promise<void> {
  const ings = await getIngredients(restaurantId);
  downloadCsv("ingredients.csv", ings.map((i) => ({
    id: i.id, name: i.name, type: i.type, supplier_name: i.supplier_name ?? "",
    total_cost: i.total_cost, original_quantity: i.original_quantity,
    original_uom_code: i.original_uom_code ?? "", recipe_uom_code: i.recipe_uom_code ?? "",
    adjustment: i.adjustment != null ? Number(i.adjustment) * 100 : "", density_g_per_ml: i.density_g_per_ml ?? "",
    recipe_unit_cost: i.cost_state?.recipe_unit_cost ?? "",
    calculation_status: i.cost_state?.calculation_status ?? "", is_active: i.is_active, updated_at: i.updated_at,
  })), [
    { key: "id", label: "id" }, { key: "name", label: "name" }, { key: "type", label: "type" },
    { key: "supplier_name", label: "supplier_name" }, { key: "total_cost", label: "total_cost" },
    { key: "original_quantity", label: "original_quantity" }, { key: "original_uom_code", label: "original_uom_code" },
    { key: "recipe_uom_code", label: "recipe_uom_code" }, { key: "adjustment", label: "adjustment_pct" },
    { key: "density_g_per_ml", label: "density_g_per_ml" }, { key: "recipe_unit_cost", label: "recipe_unit_cost" },
    { key: "calculation_status", label: "calculation_status" }, { key: "is_active", label: "is_active" },
    { key: "updated_at", label: "updated_at" },
  ]);
}

export async function exportRecipesCsv(restaurantId: string): Promise<void> {
  const recs = await getRecipes(restaurantId);
  downloadCsv("recipes.csv", recs.map((r) => ({
    id: r.id, name: r.name, kind: r.kind, category_name: r.category_name ?? "",
    serving_quantity: r.serving_quantity, serving_uom_code: r.serving_uom_code,
    menu_price: r.menu_price ?? "", is_active: r.is_active, updated_at: r.updated_at,
  })), [
    { key: "id", label: "id" }, { key: "name", label: "name" }, { key: "kind", label: "kind" },
    { key: "category_name", label: "category" }, { key: "serving_quantity", label: "serving_quantity" },
    { key: "serving_uom_code", label: "serving_uom" }, { key: "menu_price", label: "menu_price" },
    { key: "is_active", label: "is_active" }, { key: "updated_at", label: "updated_at" },
  ]);
}

export async function exportMenuAnalyticsCsv(restaurantId: string): Promise<void> {
  const { rows } = await getMenuAnalyticsData(restaurantId);
  downloadCsv("menu-analytics.csv", rows.map((r) => ({
    dish_name: r.dish_name, category: r.category_name ?? "", cogs: r.cost_per_serving,
    menu_price: r.menu_price ?? "", gp: r.gp ?? "", gpm: r.gpm != null ? (r.gpm * 100).toFixed(1) : "",
    target_gpm: (r.target_gpm * 100).toFixed(0), status: r.status,
    suggested: r.suggested_menu_price ?? "", issues: r.issues.join("; "),
  })), [
    { key: "dish_name", label: "dish" }, { key: "category", label: "category" },
    { key: "cogs", label: "cogs_per_serving" }, { key: "menu_price", label: "menu_price" },
    { key: "gp", label: "gp" }, { key: "gpm", label: "gpm_pct" }, { key: "target_gpm", label: "target_gpm_pct" },
    { key: "status", label: "status" }, { key: "suggested", label: "suggested_price" },
    { key: "issues", label: "issues" },
  ]);
}

export async function exportPriceLogCsv(restaurantId: string): Promise<void> {
  const entries = await getPriceLogEntries(restaurantId);
  downloadCsv("price-log.csv", entries.map((e) => ({
    created_at: e.created_at, event_type: e.event_type, baseline_version: e.baseline_version,
    ingredient: e.ingredient_name_at_time, supplier: e.supplier_name_at_time ?? "",
    old_ruc: e.old_recipe_unit_cost ?? "", new_ruc: e.new_recipe_unit_cost ?? "",
    delta_amount: e.delta_recipe_unit_cost_amount ?? "", delta_pct: e.delta_recipe_unit_cost_percent ?? "",
    note: e.note ?? "",
  })), [
    { key: "created_at", label: "created_at" }, { key: "event_type", label: "event_type" },
    { key: "baseline_version", label: "baseline_version" }, { key: "ingredient", label: "ingredient" },
    { key: "supplier", label: "supplier" }, { key: "old_ruc", label: "old_recipe_unit_cost" },
    { key: "new_ruc", label: "new_recipe_unit_cost" }, { key: "delta_amount", label: "delta_ruc_amount" },
    { key: "delta_pct", label: "delta_ruc_pct" }, { key: "note", label: "note" },
  ]);
}

export async function exportAlertsCsv(restaurantId: string): Promise<void> {
  const alerts = await getAlerts(restaurantId);
  downloadCsv("alerts.csv", alerts.map((a) => ({
    detected_at: a.detected_at, alert_type: a.alert_type, severity: a.severity,
    status: a.status, title: a.title, message: a.message,
    action: a.recommended_action ?? "", entity_type: a.entity_type ?? "",
  })), [
    { key: "detected_at", label: "detected_at" }, { key: "alert_type", label: "type" },
    { key: "severity", label: "severity" }, { key: "status", label: "status" },
    { key: "title", label: "title" }, { key: "message", label: "message" },
    { key: "action", label: "recommended_action" }, { key: "entity_type", label: "entity_type" },
  ]);
}
