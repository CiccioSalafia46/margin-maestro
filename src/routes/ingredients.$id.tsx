import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Package, Pencil } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  IngredientTypeBadge,
  UomBadge,
} from "@/components/common/badges";
import { EmptyState } from "@/components/common/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/auth/AuthProvider";
import { getIngredientById } from "@/data/api/ingredientsApi";
import type { IngredientWithCostState } from "@/data/api/types";
import { formatMoney, formatUnitCost } from "@/lib/format";

export const Route = createFileRoute("/ingredients/$id")({
  head: () => ({
    meta: [
      { title: "Ingredient — Margin IQ" },
      { name: "description", content: "Ingredient detail and cost breakdown." },
    ],
  }),
  component: IngredientDetailPage,
});

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message?: unknown }).message);
  return e instanceof Error ? e.message : "Something went wrong.";
}

function IngredientDetailPage() {
  const { id } = Route.useParams();
  const { activeRestaurantId, activeMembership } = useAuth();
  const [ingredient, setIngredient] = useState<IngredientWithCostState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManage = activeMembership?.role === "owner" || activeMembership?.role === "manager";

  useEffect(() => {
    if (!activeRestaurantId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getIngredientById(activeRestaurantId, id)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setError("Ingredient not found.");
        } else {
          setIngredient(data);
        }
      })
      .catch((e) => !cancelled && setError(errMsg(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [activeRestaurantId, id]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading ingredient…
        </div>
      </AppShell>
    );
  }

  if (error || !ingredient) {
    return (
      <AppShell>
        <div className="p-6">
          <EmptyState
            title="Ingredient not found"
            description={error ?? "It may have been removed or the link is invalid."}
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/ingredients">Back to ingredients</Link>
              </Button>
            }
          />
        </div>
      </AppShell>
    );
  }

  const cs = ingredient.cost_state;

  return (
    <AppShell>
      <PageHeader
        title={ingredient.name}
        description={ingredient.supplier_name ?? "No supplier assigned"}
        actions={
          <div className="flex gap-2">
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => toast.info("Edit form arrives in a future iteration.")}>
                <Pencil className="mr-1.5 h-4 w-4" /> Edit
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/ingredients">
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <IngredientTypeBadge type={ingredient.type as "Primary" | "Intermediate" | "Fixed"} />
          {!ingredient.is_active && <Badge variant="outline">Inactive</Badge>}
          {ingredient.recipe_uom_code && <UomBadge uom={ingredient.recipe_uom_code as "Gr"} />}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Cost card */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cost</CardTitle>
            </CardHeader>
            <CardContent>
              {ingredient.type === "intermediate" ? (
                <p className="text-sm text-muted-foreground">
                  Intermediate ingredient costs are calculated from recipes in Build 1.3.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <Field
                      label="Original quantity"
                      value={
                        ingredient.original_quantity != null
                          ? `${Number(ingredient.original_quantity)} ${ingredient.original_uom_code ?? ""}`
                          : "—"
                      }
                    />
                    <Field
                      label="Total cost"
                      value={ingredient.total_cost != null ? formatMoney(Number(ingredient.total_cost)) : "—"}
                    />
                    <Field
                      label="Adjustment"
                      value={
                        Number(ingredient.adjustment) === 0
                          ? "0%"
                          : `${(Number(ingredient.adjustment) * 100).toFixed(1)}%`
                      }
                    />
                    <Field label="Recipe UoM" value={ingredient.recipe_uom_code ?? "—"} />
                    <Field label="Conversion" value={ingredient.conversion_on ? "On" : "Off"} />
                    <Field
                      label="Density"
                      value={ingredient.density_g_per_ml ? `${ingredient.density_g_per_ml} g/ml` : "—"}
                    />
                    {ingredient.type === "fixed" && (
                      <Field
                        label="Manual cost"
                        value={
                          ingredient.manual_recipe_unit_cost != null
                            ? formatUnitCost(Number(ingredient.manual_recipe_unit_cost))
                            : "—"
                        }
                      />
                    )}
                  </div>
                  <Separator className="my-4" />
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      Recipe unit cost
                    </span>
                    <span className="text-2xl font-semibold tabular-nums">
                      {cs?.recipe_unit_cost != null ? formatUnitCost(Number(cs.recipe_unit_cost), 6) : "—"}
                      {ingredient.recipe_uom_code && (
                        <span className="text-sm font-normal text-muted-foreground">
                          {" "}/ {ingredient.recipe_uom_code}
                        </span>
                      )}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Cost state card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Calculation status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <CalcStatusBadge status={cs?.calculation_status ?? "pending"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Source:</span>
                <span className="text-xs font-medium">{cs?.cost_source ?? "—"}</span>
              </div>
              {cs?.calculation_error && (
                <p className="text-xs text-destructive">{cs.calculation_error}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Placeholder cards for future features */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recipes that use this ingredient</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4">
              <EmptyState
                icon={<Package className="h-5 w-5" />}
                title="Recipe usage available after Build 1.3"
                description="Recipe lines will reference ingredients once the Recipes module is implemented."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Price history</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Price Log and Price Trend persistence arrive in Build 1.5.
            </p>
          </CardContent>
        </Card>

        {ingredient.notes && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{ingredient.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function CalcStatusBadge({ status }: { status: string }) {
  if (status === "valid") return <Badge className="bg-success text-success-foreground">Valid</Badge>;
  if (status === "warning") return <Badge className="bg-warning text-warning-foreground">Warning</Badge>;
  if (status === "error") return <Badge className="bg-destructive text-destructive-foreground">Error</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
