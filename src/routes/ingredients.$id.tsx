import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Package } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  IngredientTypeBadge,
  PercentCell,
  SpikeBadge,
  UnitCostCell,
  UomBadge,
} from "@/components/common/badges";
import { EmptyState } from "@/components/common/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { getIngredientById, priceLog, recipesUsingIngredient } from "@/data/mock";
import { formatDateTime, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/ingredients/$id")({
  loader: ({ params }) => {
    const ingredient = getIngredientById(params.id);
    if (!ingredient) throw notFound();
    return { ingredient };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.ingredient.name ?? "Ingredient"} — Margin IQ` },
      {
        name: "description",
        content: `Ingredient detail, cost, price history, and recipes that consume ${loaderData?.ingredient.name ?? "this ingredient"}.`,
      },
    ],
  }),
  component: IngredientDetailPage,
  errorComponent: ({ error }) => (
    <AppShell>
      <div className="p-6">
        <EmptyState title="Failed to load ingredient" description={error.message} />
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="p-6">
        <EmptyState
          title="Ingredient not found"
          description="It may have been removed or the link is invalid."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/ingredients">Back to ingredients</Link>
            </Button>
          }
        />
      </div>
    </AppShell>
  ),
});

function IngredientDetailPage() {
  const { ingredient } = Route.useLoaderData();
  const usedIn = recipesUsingIngredient(ingredient.id);
  const history = priceLog
    .filter((p) => p.ingredient_id === ingredient.id)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return (
    <AppShell>
      <PageHeader
        title={ingredient.name}
        description={ingredient.supplier ?? "Internal preparation"}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/ingredients">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <IngredientTypeBadge type={ingredient.type} />
          <SpikeBadge active={ingredient.spike} />
          <UomBadge uom={ingredient.recipe_uom} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Original quantity" value={`${ingredient.original_qty} ${ingredient.original_uom}`} />
                <Field label="Total cost" value={formatMoney(ingredient.total_cost)} />
                <Field
                  label="Adjustment"
                  value={
                    ingredient.adjustment === 0
                      ? "0%"
                      : `${(ingredient.adjustment * 100).toFixed(1)}%`
                  }
                />
                <Field label="Recipe UoM" value={ingredient.recipe_uom} />
                <Field label="Conversion" value={ingredient.conversion_on ? "On" : "Off"} />
                <Field
                  label="Density"
                  value={
                    ingredient.density_g_per_ml
                      ? `${ingredient.density_g_per_ml} g/ml`
                      : "—"
                  }
                />
              </div>
              <Separator className="my-4" />
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Recipe unit cost
                </span>
                <span className="text-2xl font-semibold tabular-nums">
                  <UnitCostCell value={ingredient.recipe_unit_cost} decimals={6} />{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {ingredient.recipe_uom}
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Price history</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <EmptyState title="No price history" />
              ) : (
                <ul className="space-y-2">
                  {history.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between border-b border-dashed pb-2 text-sm last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="font-medium tabular-nums">
                          <UnitCostCell value={p.new_unit_cost} />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(p.timestamp)}
                        </p>
                      </div>
                      {p.event === "baseline" ? (
                        <span className="text-xs text-muted-foreground">baseline</span>
                      ) : (
                        <PercentCell value={p.pct_change} signed decimals={2} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
                <Link to="/price-trend">Open in Price Trend</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recipes that use this ingredient</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {usedIn.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Package className="h-5 w-5" />}
                  title="Not yet used in any recipe"
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipe</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usedIn.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <Link
                          to="/recipes/$id"
                          params={{ id: r.id }}
                          className="hover:underline"
                        >
                          {r.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.category}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
