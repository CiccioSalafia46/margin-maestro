// Human-readable calculation rules surfaced on the QA page.

export interface CalculationNote {
  id: string;
  title: string;
  body: string;
}

export const calculationNotes: CalculationNote[] = [
  {
    id: "uom",
    title: "UoM conversion rules",
    body: [
      "Families: mass (Gr, Kg, Lb, Oz), volume (Ml, Lt, Gl), count (Ct).",
      "Ct cannot be converted; only Ct→Ct is allowed.",
      "Mass↔mass and volume↔volume convert by fixed factors.",
      "Mass↔volume requires density_g_per_ml (no silent default).",
      "Constants: 1 Kg = 1000 Gr; 1 Lb = 453.592 Gr; 1 Oz = 28.3495 Gr;",
      "1 Lt = 1000 Ml; 1 Gl = 3785.411784 Ml (US gallon).",
    ].join(" "),
  },
  {
    id: "ing-cost",
    title: "Ingredient costing",
    body:
      "original_unit_cost = total_cost / original_quantity. " +
      "recipe_quantity = convert(original_quantity, original_uom → recipe_uom) when conversion is on, else original_quantity. " +
      "recipe_unit_cost = total_cost / (recipe_quantity × (1 + adjustment)). " +
      "Constraints: original_quantity > 0, adjustment ≠ -1.",
  },
  {
    id: "cogs",
    title: "Recipe COGS",
    body:
      "line_cost = qty (in ingredient recipe_uom) × ingredient.recipe_unit_cost. " +
      "COGS = Σ(line_cost). cost_per_serving = COGS / serving_quantity. Intermediate ingredients' costs come from their linked Intermediate recipes; circular references are flagged.",
  },
  {
    id: "margin",
    title: "GP, GPM and target",
    body:
      "GP = Menu Price − COGS/serving. GPM = GP / Menu Price. On Target = GPM ≥ target_gpm. If menu_price is 0 or missing, GP and GPM are blank.",
  },
  {
    id: "suggested",
    title: "Suggested menu price",
    body: "Suggested Menu Price = COGS/serving / (1 − target_gpm). Undefined when target_gpm ≥ 1.",
  },
  {
    id: "cascade",
    title: "Impact Cascade (ratio method)",
    body:
      "New Line Cost = Old Line Cost × (New Unit Cost / Old Unit Cost). " +
      "Delta/serving = (New Line Cost − Old Line Cost) / serving_qty. " +
      "New COGS/serving = Old COGS/serving + Delta/serving. " +
      "Old/New GPM = (Menu Price − COGS/serving) / Menu Price.",
  },
  {
    id: "precision",
    title: "Precision & display",
    body:
      "Store precise values; round only on display. Money: 2 decimals. Unit costs: 4–6 decimals. Percentages: 1–2 decimals. Pp deltas: 1 decimal.",
  },
];
