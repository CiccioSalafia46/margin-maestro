// Impact Cascade ratio-method helpers — pure, frontend-only.
//
// Ratio method (per dish, per affected ingredient line):
//   New Line Cost     = Old Line Cost × (New Unit Cost / Old Unit Cost)
//   Delta per Serving = (New Line Cost - Old Line Cost) / Serving Quantity
//   New COGS / Serving = Old COGS / Serving + Delta per Serving
//   Old GPM           = (Menu Price - Old COGS/Serving) / Menu Price
//   New GPM           = (Menu Price - New COGS/Serving) / Menu Price

export interface CascadeInputs {
  old_unit_cost: number;
  new_unit_cost: number;
  old_line_cost: number;
  serving_qty: number;
  old_cogs_per_serving: number;
  menu_price: number;
}

export interface CascadeOk {
  ok: true;
  new_line_cost: number;
  delta_per_serving: number;
  new_cogs_per_serving: number;
  old_gpm: number;
  new_gpm: number;
  delta_gpm: number;
}
export interface CascadeErr {
  ok: false;
  error: string;
}
export type CascadeResult = CascadeOk | CascadeErr;

export function computeCascadeRow(input: CascadeInputs): CascadeResult {
  const {
    old_unit_cost,
    new_unit_cost,
    old_line_cost,
    serving_qty,
    old_cogs_per_serving,
    menu_price,
  } = input;

  if (!Number.isFinite(old_unit_cost) || old_unit_cost <= 0)
    return { ok: false, error: "old_unit_cost must be > 0." };
  if (!Number.isFinite(new_unit_cost) || new_unit_cost < 0)
    return { ok: false, error: "new_unit_cost must be ≥ 0." };
  if (!Number.isFinite(serving_qty) || serving_qty <= 0)
    return { ok: false, error: "serving_qty must be > 0." };
  if (!Number.isFinite(menu_price) || menu_price <= 0)
    return { ok: false, error: "menu_price must be > 0 to compute GPM." };
  if (!Number.isFinite(old_line_cost) || old_line_cost < 0)
    return { ok: false, error: "old_line_cost must be ≥ 0." };
  if (!Number.isFinite(old_cogs_per_serving) || old_cogs_per_serving < 0)
    return { ok: false, error: "old_cogs_per_serving must be ≥ 0." };

  const new_line_cost = old_line_cost * (new_unit_cost / old_unit_cost);
  const delta_per_serving = (new_line_cost - old_line_cost) / serving_qty;
  const new_cogs_per_serving = old_cogs_per_serving + delta_per_serving;
  const old_gpm = (menu_price - old_cogs_per_serving) / menu_price;
  const new_gpm = (menu_price - new_cogs_per_serving) / menu_price;
  return {
    ok: true,
    new_line_cost,
    delta_per_serving,
    new_cogs_per_serving,
    old_gpm,
    new_gpm,
    delta_gpm: new_gpm - old_gpm,
  };
}
