import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KpiTrend = "up" | "down" | "flat";
export type KpiTone = "neutral" | "positive" | "negative" | "warning";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: KpiTrend;
  tone?: KpiTone;
  icon?: ReactNode;
  className?: string;
}

const toneStyles: Record<KpiTone, string> = {
  neutral: "text-foreground",
  positive: "text-success",
  negative: "text-destructive",
  warning: "text-warning",
};

export function KpiCard({
  label,
  value,
  hint,
  trend,
  tone = "neutral",
  icon,
  className,
}: KpiCardProps) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  return (
    <Card className={cn("border-border/70", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        <div className={cn("mt-3 text-2xl font-semibold tabular-nums", toneStyles[tone])}>
          {value}
        </div>
        {hint && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            {trend && <TrendIcon className="h-3.5 w-3.5" />}
            <span>{hint}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
