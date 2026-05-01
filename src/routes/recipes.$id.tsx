import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  MoneyCell,
  OnTargetBadge,
  PercentCell,
  RecipeTypeBadge,
  UomBadge,
  UnitCostCell,
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
import type { Recipe } from "@/lib/types";
import {
  computeRecipeMetrics,
  getIngredientById,
  getRecipeById,
  TARGET_GPM,
} from "@/data/mock";

export const Route = createFileRoute("/recipes/$id")({
  loader: ({ params }) => {
    const recipe = getRecipeById(params.id);
    if (!recipe) throw notFound();
    return { recipe };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.recipe.name ?? "Recipe"} — Margin IQ` },
      {
        name: "description",
        content: `Recipe editor with live COGS, GPM, and suggested menu price for ${loaderData?.recipe.name ?? "this recipe"}.`,
      },
    ],
  }),
  component: RecipeDetailPage,
  notFoundComponent: () => (
    <AppShell>
      <div className="p-6">
        <EmptyState
          title="Recipe not found"
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/recipes">Back to recipes</Link>
            </Button>
          }
        />
      </div>
    </AppShell>
  ),
});

function RecipeDetailPage() {
  const { recipe } = Route.useLoaderData();
  const metrics = computeRecipeMetrics(recipe);

  type LineRow = {
    line: Recipe["lines"][number];
    ingredient: ReturnType<typeof getIngredientById>;
    lineCost: number;
  };
  const lineRows: LineRow[] = recipe.lines.map((l: Recipe["lines"][number]) => {
    const ing = getIngredientById(l.ingredient_id);
    const lineCost = ing ? l.qty * ing.recipe_unit_cost : 0;
    return { line: l, ingredient: ing, lineCost };
  });

  return (
    <AppShell>
      <PageHeader
        title={recipe.name}
        description={`${recipe.category} • Serves ${recipe.serving_qty} ${recipe.serving_uom}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/recipes">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <RecipeTypeBadge type={recipe.type} />
          {recipe.type === "Dish" && <OnTargetBadge onTarget={metrics.on_target} />}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ingredient lines</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>UoM</TableHead>
                    <TableHead className="text-right">Unit cost</TableHead>
                    <TableHead className="text-right">Line cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineRows.map(({ line, ingredient, lineCost }) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">
                        {ingredient ? (
                          <Link
                            to="/ingredients/$id"
                            params={{ id: ingredient.id }}
                            className="hover:underline"
                          >
                            {ingredient.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{line.qty}</TableCell>
                      <TableCell>
                        <UomBadge uom={line.uom} />
                      </TableCell>
                      <TableCell className="text-right">
                        <UnitCostCell value={ingredient?.recipe_unit_cost} decimals={4} />
                      </TableCell>
                      <TableCell className="text-right">
                        <MoneyCell value={lineCost} decimals={2} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Live totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Stat label="COGS" value={<MoneyCell value={metrics.cogs} />} />
              <Stat
                label="Cost per serving"
                value={<UnitCostCell value={metrics.cost_per_serving} decimals={4} />}
              />
              {recipe.type === "Dish" && (
                <>
                  <Separator />
                  <Stat
                    label="Menu price"
                    value={
                      recipe.menu_price === null || recipe.menu_price === 0 ? (
                        <span className="text-xs italic text-muted-foreground">
                          Set menu price
                        </span>
                      ) : (
                        <MoneyCell value={recipe.menu_price} />
                      )
                    }
                  />
                  <Stat label="GP" value={<MoneyCell value={metrics.gp} />} />
                  <Stat label="GPM" value={<PercentCell value={metrics.gpm} />} />
                  <Separator />
                  <Stat
                    label={`Suggested menu price @ ${(TARGET_GPM * 100).toFixed(0)}%`}
                    value={<MoneyCell value={metrics.suggested_menu_price} />}
                    emphasize
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: React.ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span
        className={
          emphasize
            ? "text-lg font-semibold tabular-nums text-primary"
            : "text-sm font-medium tabular-nums"
        }
      >
        {value}
      </span>
    </div>
  );
}
