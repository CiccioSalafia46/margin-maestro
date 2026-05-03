import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Database, Loader2, Power } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  MoneyCell,
  OnTargetBadge,
  PercentCell,
  UnitCostCell,
  UomBadge,
} from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useAuth } from "@/auth/AuthProvider";
import { getIngredients } from "@/data/api/ingredientsApi";
import { getMenuCategories } from "@/data/api/settingsApi";
import {
  calculateRecipeMetrics,
  createRecipe,
  deactivateRecipe,
  getRecipes,
} from "@/data/api/recipesApi";
import type {
  IngredientWithCostState,
  MenuCategoryRow,
  RecipeInput,
  RecipeKind,
  RecipeMetrics,
  RecipeWithLines,
} from "@/data/api/types";

export const Route = createFileRoute("/recipes/")({
  head: () => ({
    meta: [
      { title: "Recipes — Margin IQ" },
      { name: "description", content: "Recipe database with COGS, margins, and cost breakdown." },
    ],
  }),
  component: RecipesPage,
});

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message?: unknown }).message);
  return e instanceof Error ? e.message : "Something went wrong.";
}

const UOM_CODES = ["Ct", "Gr", "Kg", "Lb", "Oz", "Gl", "Lt", "Ml"] as const;

function RecipesPage() {
  const { activeRestaurantId, activeMembership, activeRestaurantSettings } = useAuth();
  const [recipes, setRecipes] = useState<RecipeWithLines[]>([]);
  const [ingredients, setIngredients] = useState<IngredientWithCostState[]>([]);
  const [categories, setCategories] = useState<MenuCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dish");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const role = activeMembership?.role;
  const canManage = role === "owner" || role === "manager";
  const targetGpm = activeRestaurantSettings?.target_gpm ?? 0.78;

  const load = useCallback(async () => {
    if (!activeRestaurantId) return;
    setLoading(true);
    try {
      const [recs, ings, cats] = await Promise.all([
        getRecipes(activeRestaurantId),
        getIngredients(activeRestaurantId),
        getMenuCategories(activeRestaurantId),
      ]);
      setRecipes(recs);
      setIngredients(ings);
      setCategories(cats);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [activeRestaurantId]);

  useEffect(() => { void load(); }, [load]);

  const metricsMap = useMemo(() => {
    const map = new Map<string, RecipeMetrics>();
    for (const r of recipes) {
      map.set(r.id, calculateRecipeMetrics(r, r.lines, ingredients, targetGpm));
    }
    return map;
  }, [recipes, ingredients, targetGpm]);

  const filtered = useMemo(
    () => recipes.filter((r) => r.kind === tab && r.is_active),
    [recipes, tab],
  );
  const dishCount = recipes.filter((r) => r.kind === "dish" && r.is_active).length;
  const intCount = recipes.filter((r) => r.kind === "intermediate" && r.is_active).length;

  const onDeactivate = async (id: string) => {
    if (!activeRestaurantId) return;
    try {
      await deactivateRecipe(activeRestaurantId, id);
      toast.success("Recipe deactivated.");
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (!activeRestaurantId || !activeMembership) {
    return (
      <AppShell>
        <PageHeader title="Recipes" description="Recipe database." />
        <div className="p-6 text-sm text-muted-foreground">No active restaurant.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Recipes"
        description={loading ? "Loading…" : `${recipes.filter((r) => r.is_active).length} active recipe(s).`}
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setDrawerOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add Recipe
            </Button>
          ) : undefined
        }
      />
      <div className="space-y-4 p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="dish">
              Dishes <Badge variant="outline" className="ml-1.5 text-[10px]">{dishCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="intermediate">
              Intermediates <Badge variant="outline" className="ml-1.5 text-[10px]">{intCount}</Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dish" className="mt-4">
            <RecipeTable recipes={filtered} metricsMap={metricsMap} kind="dish" canManage={canManage} onDeactivate={onDeactivate} loading={loading} />
          </TabsContent>
          <TabsContent value="intermediate" className="mt-4">
            <RecipeTable recipes={filtered} metricsMap={metricsMap} kind="intermediate" canManage={canManage} onDeactivate={onDeactivate} loading={loading} />
          </TabsContent>
        </Tabs>
      </div>

      {canManage && (
        <AddRecipeDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          restaurantId={activeRestaurantId}
          categories={categories}
          ingredients={ingredients}
          onCreated={load}
        />
      )}
    </AppShell>
  );
}

function RecipeTable({
  recipes, metricsMap, kind, canManage, onDeactivate, loading,
}: {
  recipes: RecipeWithLines[];
  metricsMap: Map<string, RecipeMetrics>;
  kind: RecipeKind;
  canManage: boolean;
  onDeactivate: (id: string) => Promise<void>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading recipes…
      </div>
    );
  }
  const isDish = kind === "dish";
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Recipe</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">COGS</TableHead>
            <TableHead className="text-right">Serving</TableHead>
            <TableHead>UoM</TableHead>
            <TableHead className="text-right">Cost/serving</TableHead>
            {isDish && <TableHead className="text-right">Menu price</TableHead>}
            {isDish && <TableHead className="text-right">GPM</TableHead>}
            {isDish && <TableHead>Target</TableHead>}
            {canManage && <TableHead className="w-20 text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={isDish ? (canManage ? 10 : 9) : (canManage ? 7 : 6)} className="py-12">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Database className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-medium">No {kind} recipes yet.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            recipes.map((r) => {
              const m = metricsMap.get(r.id);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <Link to="/recipes/$id" params={{ id: r.id }} className="hover:underline">{r.name}</Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.category_name ?? "—"}</TableCell>
                  <TableCell className="text-right"><MoneyCell value={m?.cogs ?? 0} /></TableCell>
                  <TableCell className="text-right tabular-nums">{Number(r.serving_quantity)}</TableCell>
                  <TableCell><UomBadge uom={r.serving_uom_code as "Gr"} /></TableCell>
                  <TableCell className="text-right"><UnitCostCell value={m?.cost_per_serving ?? 0} decimals={4} /></TableCell>
                  {isDish && (
                    <TableCell className="text-right">
                      {r.menu_price != null ? <MoneyCell value={Number(r.menu_price)} /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  {isDish && (
                    <TableCell className="text-right">
                      {m?.gpm != null ? <PercentCell value={m.gpm} decimals={1} /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  {isDish && (
                    <TableCell>{m?.on_target != null ? <OnTargetBadge onTarget={m.on_target} /> : "—"}</TableCell>
                  )}
                  {canManage && (
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => onDeactivate(r.id)}>
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Add Recipe Drawer ────────────────────────────────────────────────

function AddRecipeDrawer({
  open, onOpenChange, restaurantId, categories, ingredients, onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  categories: MenuCategoryRow[];
  ingredients: IngredientWithCostState[];
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RecipeKind>("dish");
  const [categoryId, setCategoryId] = useState("none");
  const [servQty, setServQty] = useState("1");
  const [servUom, setServUom] = useState("Ct");
  const [menuPrice, setMenuPrice] = useState("");
  const [linkedIngId, setLinkedIngId] = useState("none");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const intermediateIngredients = ingredients.filter((i) => i.type === "intermediate" && i.is_active);

  const resetForm = () => {
    setName(""); setKind("dish"); setCategoryId("none");
    setServQty("1"); setServUom("Ct"); setMenuPrice("");
    setLinkedIngId("none"); setNotes("");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const input: RecipeInput = {
        name,
        kind,
        menu_category_id: categoryId === "none" ? null : categoryId,
        serving_quantity: Number(servQty) || 1,
        serving_uom_code: servUom,
        menu_price: kind === "dish" && menuPrice ? Number(menuPrice) : null,
        linked_intermediate_ingredient_id: kind === "intermediate" && linkedIngId !== "none" ? linkedIngId : null,
        notes: notes || null,
      };
      await createRecipe(restaurantId, input);
      toast.success(`Recipe "${name}" created. Open it to add ingredient lines.`);
      resetForm();
      onOpenChange(false);
      await onCreated();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add Recipe</SheetTitle>
          <SheetDescription>Create a new recipe. Add ingredient lines on the detail page.</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Margherita Pizza" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kind *</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as RecipeKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dish">Dish</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.filter((c) => c.is_active).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Serving qty *</Label>
              <Input type="number" min={0.001} step="any" required value={servQty} onChange={(e) => setServQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Serving UoM *</Label>
              <Select value={servUom} onValueChange={setServUom}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UOM_CODES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {kind === "dish" && (
            <div className="space-y-1.5">
              <Label>Menu price (USD)</Label>
              <Input type="number" min={0} step="any" value={menuPrice} onChange={(e) => setMenuPrice(e.target.value)} />
            </div>
          )}

          {kind === "intermediate" && (
            <div className="space-y-1.5">
              <Label>Linked Intermediate Ingredient</Label>
              <Select value={linkedIngId} onValueChange={setLinkedIngId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (create ingredient separately)</SelectItem>
                  {intermediateIngredients.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Saving this recipe will update the linked ingredient's cost state.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : "Create recipe"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
