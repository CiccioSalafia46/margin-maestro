import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Database, Search, Loader2, Power } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import {
  IngredientTypeBadge,
  UomBadge,
} from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/auth/AuthProvider";
import {
  calculateCostState,
  createIngredient,
  deactivateIngredient,
  getIngredients,
  upsertIngredientCostState,
} from "@/data/api/ingredientsApi";
import { getSuppliers } from "@/data/api/settingsApi";
import type {
  IngredientInput,
  IngredientType,
  IngredientWithCostState,
  SupplierRow,
} from "@/data/api/types";
import { formatUnitCost } from "@/lib/format";

export const Route = createFileRoute("/ingredients")({
  head: () => ({
    meta: [
      { title: "Ingredients — Margin IQ" },
      {
        name: "description",
        content:
          "Ingredient database with supplier, pack size, recipe unit cost, and cost calculation status.",
      },
    ],
  }),
  component: IngredientsPage,
});

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message?: unknown }).message);
  return e instanceof Error ? e.message : "Something went wrong.";
}

const UOM_CODES = ["Ct", "Gr", "Kg", "Lb", "Oz", "Gl", "Lt", "Ml"] as const;

function IngredientsPage() {
  const { activeRestaurantId, activeMembership } = useAuth();
  const [ingredients, setIngredients] = useState<IngredientWithCostState[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<string>("all");
  const [supplier, setSupplier] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const role = activeMembership?.role;
  const canManage = role === "owner" || role === "manager";

  const load = useCallback(async () => {
    if (!activeRestaurantId) return;
    setLoading(true);
    try {
      const [ings, sups] = await Promise.all([
        getIngredients(activeRestaurantId),
        getSuppliers(activeRestaurantId),
      ]);
      setIngredients(ings);
      setSuppliers(sups);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [activeRestaurantId]);

  useEffect(() => { void load(); }, [load]);

  const supplierNames = useMemo(
    () => Array.from(new Set(ingredients.map((i) => i.supplier_name).filter(Boolean) as string[])).sort(),
    [ingredients],
  );

  const filtered = ingredients.filter((i) => {
    if (type !== "all" && i.type !== type) return false;
    if (supplier !== "all" && i.supplier_name !== supplier) return false;
    if (statusFilter === "active" && !i.is_active) return false;
    if (statusFilter === "inactive" && i.is_active) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const onDeactivate = async (id: string) => {
    if (!activeRestaurantId) return;
    try {
      await deactivateIngredient(activeRestaurantId, id);
      toast.success("Ingredient deactivated.");
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (!activeRestaurantId || !activeMembership) {
    return (
      <AppShell>
        <PageHeader title="Ingredients" description="Ingredient database." />
        <div className="p-6 text-sm text-muted-foreground">No active restaurant.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Ingredients"
        description={loading ? "Loading…" : `${ingredients.length} ingredient(s) in database.`}
        actions={
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button variant="outline" size="sm" disabled>
                      Run Price Update
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Price Log and Snapshot arrive in Build 1.5.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {canManage && (
              <Button size="sm" onClick={() => setDrawerOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add Ingredient
              </Button>
            )}
          </>
        }
      />

      <FilterBar>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search ingredient"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-56 pl-8"
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="primary">Primary</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="fixed">Fixed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={supplier} onValueChange={setSupplier}>
          <SelectTrigger className="h-9 w-56">
            <SelectValue placeholder="Supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {supplierNames.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <p className="ml-auto text-xs text-muted-foreground">
          Showing {filtered.length} of {ingredients.length}
        </p>
      </FilterBar>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading ingredients…
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Total cost</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>UoM</TableHead>
                  <TableHead>Recipe UoM</TableHead>
                  <TableHead className="text-right">Adj</TableHead>
                  <TableHead className="text-right">Recipe unit cost</TableHead>
                  <TableHead>Calc</TableHead>
                  {canManage && <TableHead className="w-24 text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 11 : 10} className="py-12">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <Database className="h-6 w-6 text-muted-foreground" />
                        <p className="text-sm font-medium">No ingredients match these filters.</p>
                        <p className="text-xs text-muted-foreground">
                          {ingredients.length === 0
                            ? "Add your first ingredient to get started."
                            : "Try adjusting the filters."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((i) => (
                    <TableRow key={i.id} className={i.is_active ? "" : "opacity-60"}>
                      <TableCell className="font-medium">
                        <Link
                          to="/ingredients/$id"
                          params={{ id: i.id }}
                          className="hover:underline"
                        >
                          {i.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <IngredientTypeBadge type={i.type as "Primary" | "Intermediate" | "Fixed"} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {i.supplier_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {i.type === "intermediate"
                          ? "—"
                          : i.total_cost != null
                            ? `$${Number(i.total_cost).toFixed(2)}`
                            : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {i.original_quantity != null
                          ? Number(i.original_quantity).toLocaleString("en-US")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {i.original_uom_code ? (
                          <UomBadge uom={i.original_uom_code as "Gr"} />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {i.recipe_uom_code ? (
                          <UomBadge uom={i.recipe_uom_code as "Gr"} />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {i.adjustment !== 0
                          ? `${(Number(i.adjustment) * 100).toFixed(1)}%`
                          : "0%"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {i.cost_state?.recipe_unit_cost != null
                          ? formatUnitCost(Number(i.cost_state.recipe_unit_cost))
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <CalcBadge status={i.cost_state?.calculation_status ?? "pending"} />
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          {i.is_active && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onDeactivate(i.id)}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {canManage && (
        <AddIngredientDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          restaurantId={activeRestaurantId}
          suppliers={suppliers}
          onCreated={load}
        />
      )}
    </AppShell>
  );
}

function CalcBadge({ status }: { status: string }) {
  if (status === "valid") return <Badge className="bg-success text-success-foreground text-[10px]">OK</Badge>;
  if (status === "warning") return <Badge className="bg-warning text-warning-foreground text-[10px]">Warn</Badge>;
  if (status === "error") return <Badge className="bg-destructive text-destructive-foreground text-[10px]">Err</Badge>;
  return <Badge variant="outline" className="text-[10px]">Pending</Badge>;
}

// ── Add Ingredient Drawer ────────────────────────────────────────────

function AddIngredientDrawer({
  open,
  onOpenChange,
  restaurantId,
  suppliers,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  suppliers: SupplierRow[];
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [ingType, setIngType] = useState<IngredientType>("primary");
  const [supplierId, setSupplierId] = useState<string>("none");
  const [totalCost, setTotalCost] = useState("");
  const [originalQty, setOriginalQty] = useState("");
  const [originalUom, setOriginalUom] = useState("Kg");
  const [recipeUom, setRecipeUom] = useState("Gr");
  const [adjustment, setAdjustment] = useState("0");
  const [densityStr, setDensityStr] = useState("");
  const [manualCost, setManualCost] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName(""); setIngType("primary"); setSupplierId("none");
    setTotalCost(""); setOriginalQty(""); setOriginalUom("Kg");
    setRecipeUom("Gr"); setAdjustment("0"); setDensityStr("");
    setManualCost(""); setNotes("");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const input: IngredientInput = {
        name,
        type: ingType,
        supplier_id: supplierId === "none" ? null : supplierId,
        total_cost: ingType === "primary" ? Number(totalCost) || null : null,
        original_quantity: ingType === "primary" ? Number(originalQty) || null : null,
        original_uom_code: ingType !== "intermediate" ? originalUom : null,
        conversion_on: true,
        recipe_uom_code: ingType !== "intermediate" ? recipeUom : null,
        adjustment: Number(adjustment) / 100 || 0,
        density_g_per_ml: densityStr ? Number(densityStr) : null,
        manual_recipe_unit_cost: ingType === "fixed" ? Number(manualCost) || null : null,
        notes: notes || null,
      };

      const created = await createIngredient(restaurantId, input);
      const costState = calculateCostState(created);
      await upsertIngredientCostState(restaurantId, created.id, costState);

      toast.success(`Ingredient "${created.name}" created.`);
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
          <SheetTitle>Add Ingredient</SheetTitle>
          <SheetDescription>Create a new ingredient in the database.</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="ing-name">Name *</Label>
            <Input id="ing-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Pecorino Romano" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={ingType} onValueChange={(v) => setIngType(v as IngredientType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {suppliers.filter((s) => s.is_active).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {ingType === "primary" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Original qty *</Label>
                  <Input type="number" min={0.001} step="any" required value={originalQty} onChange={(e) => setOriginalQty(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Original UoM *</Label>
                  <Select value={originalUom} onValueChange={setOriginalUom}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UOM_CODES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Total cost *</Label>
                  <Input type="number" min={0} step="any" required value={totalCost} onChange={(e) => setTotalCost(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Recipe UoM *</Label>
                  <Select value={recipeUom} onValueChange={setRecipeUom}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UOM_CODES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Adjustment (%)</Label>
                  <Input type="number" step="any" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Density (g/ml)</Label>
                  <Input type="number" min={0} step="any" value={densityStr} onChange={(e) => setDensityStr(e.target.value)} placeholder="For mass↔volume" />
                </div>
              </div>
            </>
          )}

          {ingType === "fixed" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Recipe UoM *</Label>
                <Select value={recipeUom} onValueChange={setRecipeUom}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UOM_CODES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Manual cost per unit *</Label>
                <Input type="number" min={0} step="any" required value={manualCost} onChange={(e) => setManualCost(e.target.value)} />
              </div>
            </div>
          )}

          {ingType === "intermediate" && (
            <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Intermediate ingredient costs are calculated from recipes in Build 1.3. The cost state will show as pending until a recipe is linked.
            </p>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : "Save ingredient"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
