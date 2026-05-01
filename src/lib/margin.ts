// Centralized financial calculation helpers.
//
// Canonical formulas:
//   GP                   = Menu Price - COGS
//   GPM                  = GP / Menu Price
//   On Target            = GPM >= target_gpm
//   Suggested Menu Price = COGS / (1 - target_gpm)

const EPSILON = 1e-9;

export function isPriceable(menuPrice: number | null | undefined): menuPrice is number {
  return typeof menuPrice === "number" && Number.isFinite(menuPrice) && menuPrice > 0;
}

export function computeGP(menuPrice: number | null | undefined, cogs: number): number | null {
  if (!isPriceable(menuPrice)) return null;
  return menuPrice - cogs;
}

export function computeGPM(menuPrice: number | null | undefined, cogs: number): number | null {
  if (!isPriceable(menuPrice)) return null;
  return (menuPrice - cogs) / menuPrice;
}

export function isOnTarget(gpm: number | null, targetGpm: number): boolean {
  if (gpm === null || !Number.isFinite(gpm)) return false;
  return gpm + EPSILON >= targetGpm;
}

/**
 * Suggested Menu Price = COGS / (1 - target_gpm)
 * Returns null when target_gpm >= 1 (degenerate) or COGS not finite.
 */
export function suggestedMenuPrice(cogs: number, targetGpm: number): number | null {
  if (!Number.isFinite(cogs) || cogs < 0) return null;
  const denom = 1 - targetGpm;
  if (denom <= EPSILON) return null;
  return cogs / denom;
}

export function pctChange(oldVal: number | null, newVal: number): number | null {
  if (oldVal === null || !Number.isFinite(oldVal) || Math.abs(oldVal) < EPSILON) return null;
  return (newVal - oldVal) / oldVal;
}
