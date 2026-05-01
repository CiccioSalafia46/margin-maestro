import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IngredientType, RecipeType, AlertSeverity, AlertStatus, UoM } from "@/lib/types";
import {
  formatPercent,
  formatPpDelta,
  formatMoney,
  formatSignedMoney,
  formatUnitCost,
} from "@/lib/format";

// ---------- On Target / Below Target ----------

export function OnTargetBadge({ onTarget }: { onTarget: boolean }) {
  return onTarget ? (
    <Badge
      variant="outline"
      className="border-success/30 bg-success/10 text-success font-medium"
    >
      On Target
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-destructive/30 bg-destructive/10 text-destructive font-medium"
    >
      Below Target
    </Badge>
  );
}

// ---------- Ingredient Type ----------

const ingredientTypeStyles: Record<IngredientType, string> = {
  Primary: "border-info/30 bg-info/10 text-info",
  Intermediate: "border-chart-5/30 bg-chart-5/10 text-chart-5",
  Fixed: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

export function IngredientTypeBadge({ type }: { type: IngredientType }) {
  return (
    <Badge variant="outline" className={cn("font-medium", ingredientTypeStyles[type])}>
      {type}
    </Badge>
  );
}

// ---------- Recipe Type ----------

export function RecipeTypeBadge({ type }: { type: RecipeType }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        type === "Dish"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-chart-5/30 bg-chart-5/10 text-chart-5",
      )}
    >
      {type}
    </Badge>
  );
}

// ---------- UoM ----------

export function UomBadge({ uom }: { uom: UoM }) {
  return (
    <span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
      {uom}
    </span>
  );
}

// ---------- Alert severity / status ----------

const severityStyles: Record<AlertSeverity, string> = {
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-warning/40 bg-warning/15 text-warning-foreground",
  info: "border-info/30 bg-info/10 text-info",
};

export function AlertSeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", severityStyles[severity])}>
      {severity}
    </Badge>
  );
}

const statusStyles: Record<AlertStatus, string> = {
  open: "border-destructive/30 bg-destructive/10 text-destructive",
  acknowledged: "border-warning/40 bg-warning/15 text-warning-foreground",
  resolved: "border-success/30 bg-success/10 text-success",
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", statusStyles[status])}>
      {status}
    </Badge>
  );
}

// ---------- Spike badge ----------

export function SpikeBadge({ active }: { active: boolean }) {
  if (!active) {
    return <span className="text-xs text-muted-foreground">Stable</span>;
  }
  return (
    <Badge
      variant="outline"
      className="border-destructive/30 bg-destructive/10 text-destructive font-medium"
    >
      Spike
    </Badge>
  );
}

// ---------- Display helpers (cells) ----------

export function MoneyCell({
  value,
  decimals = 2,
  className,
}: {
  value: number | null | undefined;
  decimals?: number;
  className?: string;
}) {
  return <span className={cn("tabular-nums", className)}>{formatMoney(value, { decimals })}</span>;
}

export function UnitCostCell({
  value,
  decimals = 4,
  className,
}: {
  value: number | null | undefined;
  decimals?: number;
  className?: string;
}) {
  return <span className={cn("tabular-nums", className)}>{formatUnitCost(value, decimals)}</span>;
}

export function PercentCell({
  value,
  decimals = 1,
  signed = false,
  className,
}: {
  value: number | null | undefined;
  decimals?: number;
  signed?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      {formatPercent(value, { decimals, signed })}
    </span>
  );
}

export function PpDeltaCell({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }
  const tone =
    value < 0 ? "text-destructive" : value > 0 ? "text-success" : "text-muted-foreground";
  return <span className={cn("tabular-nums font-medium", tone, className)}>{formatPpDelta(value)}</span>;
}

export function SignedMoneyCell({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }
  const tone =
    value < 0 ? "text-destructive" : value > 0 ? "text-success" : "text-muted-foreground";
  return (
    <span className={cn("tabular-nums font-medium", tone, className)}>
      {formatSignedMoney(value)}
    </span>
  );
}
