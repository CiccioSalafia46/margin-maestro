// Unit of Measure helpers — pure, frontend-only.
//
// Families:
//   mass:   Gr, Kg, Lb, Oz
//   volume: Ml, Lt, Gl
//   count:  Ct
//
// Canonical bases:
//   mass canonical   = grams
//   volume canonical = milliliters
//   count canonical  = count (no conversion)
//
// Constants (exact-as-possible):
//   1 Kg = 1000 Gr
//   1 Lb = 453.592 Gr
//   1 Oz = 28.3495 Gr
//   1 Lt = 1000 Ml
//   1 Gl = 3785.411784 Ml  (US gallon)

import type { UoM } from "./types";

export type UnitFamily = "mass" | "volume" | "count";

const MASS: ReadonlySet<UoM> = new Set<UoM>(["Gr", "Kg", "Lb", "Oz"]);
const VOLUME: ReadonlySet<UoM> = new Set<UoM>(["Ml", "Lt", "Gl"]);
const COUNT: ReadonlySet<UoM> = new Set<UoM>(["Ct"]);

// Convert 1 unit of UoM into its family's canonical base
const TO_GRAMS: Record<string, number> = {
  Gr: 1,
  Kg: 1000,
  Lb: 453.592,
  Oz: 28.3495,
};

const TO_ML: Record<string, number> = {
  Ml: 1,
  Lt: 1000,
  Gl: 3785.411784,
};

export function getUnitFamily(uom: UoM): UnitFamily {
  if (MASS.has(uom)) return "mass";
  if (VOLUME.has(uom)) return "volume";
  if (COUNT.has(uom)) return "count";
  // Should be unreachable for declared UoM type
  throw new Error(`Unknown UoM: ${uom}`);
}

export function requiresDensity(fromUom: UoM, toUom: UoM): boolean {
  const a = getUnitFamily(fromUom);
  const b = getUnitFamily(toUom);
  return (a === "mass" && b === "volume") || (a === "volume" && b === "mass");
}

export interface UnitValidation {
  ok: boolean;
  error?: string;
}

export function validateUnitConversion(
  fromUom: UoM,
  toUom: UoM,
  density_g_per_ml?: number,
): UnitValidation {
  const a = getUnitFamily(fromUom);
  const b = getUnitFamily(toUom);

  if (a === "count" || b === "count") {
    if (fromUom === "Ct" && toUom === "Ct") return { ok: true };
    return { ok: false, error: "Ct cannot be converted to or from other units." };
  }
  if (a === b) return { ok: true };
  // cross-family between mass and volume
  if (
    density_g_per_ml === undefined ||
    density_g_per_ml === null ||
    !Number.isFinite(density_g_per_ml) ||
    density_g_per_ml <= 0
  ) {
    return {
      ok: false,
      error: `Converting ${fromUom} → ${toUom} requires a positive density_g_per_ml.`,
    };
  }
  return { ok: true };
}

export function canConvert(
  fromUom: UoM,
  toUom: UoM,
  density_g_per_ml?: number,
): boolean {
  return validateUnitConversion(fromUom, toUom, density_g_per_ml).ok;
}

export interface ConvertOk {
  ok: true;
  value: number;
}
export interface ConvertErr {
  ok: false;
  error: string;
}
export type ConvertResult = ConvertOk | ConvertErr;

/**
 * Convert `value` from `fromUom` to `toUom`. Returns a structured result rather
 * than throwing. NaN/Infinity inputs produce a validation error.
 */
export function convertQuantity(
  value: number,
  fromUom: UoM,
  toUom: UoM,
  density_g_per_ml?: number,
): ConvertResult {
  if (!Number.isFinite(value)) return { ok: false, error: "Quantity must be a finite number." };

  const v = validateUnitConversion(fromUom, toUom, density_g_per_ml);
  if (!v.ok) return { ok: false, error: v.error ?? "Invalid conversion." };

  if (fromUom === toUom) return { ok: true, value };

  const fromFamily = getUnitFamily(fromUom);
  const toFamily = getUnitFamily(toUom);

  // count→count handled by fromUom===toUom above
  if (fromFamily === "mass" && toFamily === "mass") {
    const grams = value * TO_GRAMS[fromUom];
    return { ok: true, value: grams / TO_GRAMS[toUom] };
  }
  if (fromFamily === "volume" && toFamily === "volume") {
    const ml = value * TO_ML[fromUom];
    return { ok: true, value: ml / TO_ML[toUom] };
  }
  // cross family — density required & validated above
  const d = density_g_per_ml as number;
  if (fromFamily === "volume" && toFamily === "mass") {
    const ml = value * TO_ML[fromUom];
    const grams = ml * d;
    return { ok: true, value: grams / TO_GRAMS[toUom] };
  }
  if (fromFamily === "mass" && toFamily === "volume") {
    const grams = value * TO_GRAMS[fromUom];
    const ml = grams / d;
    return { ok: true, value: ml / TO_ML[toUom] };
  }
  return { ok: false, error: "Unsupported conversion." };
}
