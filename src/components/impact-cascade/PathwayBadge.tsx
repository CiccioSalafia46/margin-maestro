import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CascadeImpactPathStep } from "@/lib/cascade";

export function PathwayBadge({ pathway }: { pathway: "direct" | "indirect" }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium capitalize",
        pathway === "direct"
          ? "border-info/30 bg-info/10 text-info"
          : "border-chart-5/30 bg-chart-5/10 text-chart-5",
      )}
    >
      {pathway}
    </Badge>
  );
}

/** Render an impact path like: Sundried Tomatoes → Ravioli alla Siciliana
 *  or: Tomato → Marinara Sauce → Lasagne Tradizionali */
export function ImpactPath({ path }: { path: CascadeImpactPathStep[] }) {
  const labels = path.map((s) => {
    if (s.kind === "primary") return s.ingredient_name ?? "?";
    if (s.kind === "intermediate") return s.recipe_name ?? s.ingredient_name ?? "?";
    return s.recipe_name ?? "?";
  });
  return (
    <p className="mt-1 truncate text-xs text-muted-foreground" title={labels.join(" → ")}>
      {labels.join(" → ")}
    </p>
  );
}
