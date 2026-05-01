import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ChefHat } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import {
  MoneyCell,
  OnTargetBadge,
  PercentCell,
  RecipeTypeBadge,
  UomBadge,
  UnitCostCell,
} from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recipes, computeRecipeMetrics } from "@/data/mock";

export const Route = createFileRoute("/recipes")({
  head: () => ({
    meta: [
      { title: "Recipes — Margin IQ" },
      {
        name: "description",
        content: "Dishes and intermediate recipes with COGS, cost per serving, and GPM.",
      },
    ],
  }),
  component: RecipesPage,
});

function RecipesPage() {
  const [tab, setTab] = useState<"Dish" | "Intermediate">("Dish");
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <AppShell>
      <PageHeader
        title="Recipes"
        description="Dishes feed Menu Analytics. Intermediates flow back into ingredient costs."
        actions={
          <Button size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Recipe
          </Button>
        }
      />

      <div className="p-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "Dish" | "Intermediate")}>
          <TabsList>
            <TabsTrigger value="Dish">
              Dishes
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                {recipes.filter((r) => r.type === "Dish").length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="Intermediate">
              Intermediates
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                {recipes.filter((r) => r.type === "Intermediate").length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="Dish" className="mt-4">
            <RecipeTable kind="Dish" />
          </TabsContent>
          <TabsContent value="Intermediate" className="mt-4">
            <RecipeTable kind="Intermediate" />
          </TabsContent>
        </Tabs>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Add Recipe</SheetTitle>
            <SheetDescription>
              Mock form — values are not saved in this build.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="rec-name">Recipe name</Label>
              <Input id="rec-name" placeholder="e.g., Risotto ai Funghi" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select defaultValue="Dish">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dish">Dish</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-cat">Category</Label>
                <Input id="rec-cat" placeholder="Pasta, Pizza, Antipasti…" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rec-srv">Serving qty</Label>
                <Input id="rec-srv" type="number" min={0.01} step={0.01} placeholder="1" />
              </div>
              <div className="space-y-1.5">
                <Label>Serving UoM</Label>
                <Select defaultValue="Ct">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Ct", "Gr", "Kg", "Lb", "Oz", "Gl", "Lt", "Ml"].map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-price">Menu price (USD)</Label>
                <Input id="rec-price" type="number" min={0} step={0.01} placeholder="0.00" />
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.info("Mock UI — recipe was not saved.");
                setDrawerOpen(false);
              }}
            >
              Save (mock)
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function RecipeTable({ kind }: { kind: "Dish" | "Intermediate" }) {
  const rows = recipes
    .filter((r) => r.type === kind)
    .map((r) => ({ recipe: r, metrics: computeRecipeMetrics(r) }));

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center">
        <ChefHat className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">No recipes yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Recipe</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">COGS</TableHead>
            <TableHead className="text-right">Serving qty</TableHead>
            <TableHead>Serving UoM</TableHead>
            <TableHead className="text-right">Cost / serving</TableHead>
            {kind === "Dish" && (
              <>
                <TableHead className="text-right">Menu price</TableHead>
                <TableHead className="text-right">GPM</TableHead>
                <TableHead>Status</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ recipe, metrics }) => (
            <TableRow key={recipe.id}>
              <TableCell className="font-medium">
                <Link to="/recipes/$id" params={{ id: recipe.id }} className="hover:underline">
                  {recipe.name}
                </Link>
              </TableCell>
              <TableCell>
                <RecipeTypeBadge type={recipe.type} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{recipe.category}</TableCell>
              <TableCell className="text-right">
                <MoneyCell value={metrics.cogs} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{recipe.serving_qty}</TableCell>
              <TableCell>
                <UomBadge uom={recipe.serving_uom} />
              </TableCell>
              <TableCell className="text-right">
                <UnitCostCell value={metrics.cost_per_serving} decimals={4} />
              </TableCell>
              {kind === "Dish" && (
                <>
                  <TableCell className="text-right">
                    {recipe.menu_price === null || recipe.menu_price === 0 ? (
                      <span className="text-xs italic text-muted-foreground">Set menu price</span>
                    ) : (
                      <MoneyCell value={recipe.menu_price} />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <PercentCell value={metrics.gpm} />
                  </TableCell>
                  <TableCell>
                    <OnTargetBadge onTarget={metrics.on_target} />
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
