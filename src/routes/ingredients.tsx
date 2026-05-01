import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Database, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import {
  IngredientTypeBadge,
  PercentCell,
  SpikeBadge,
  UnitCostCell,
  UomBadge,
} from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ingredients } from "@/data/mock";

export const Route = createFileRoute("/ingredients")({
  head: () => ({
    meta: [
      { title: "Ingredients — Margin IQ" },
      {
        name: "description",
        content:
          "Ingredient database with supplier, pack size, recipe unit cost, and price spike status.",
      },
    ],
  }),
  component: IngredientsPage,
});

function IngredientsPage() {
  const [type, setType] = useState<string>("all");
  const [supplier, setSupplier] = useState<string>("all");
  const [spikeOnly, setSpikeOnly] = useState<string>("any");
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const suppliers = useMemo(
    () =>
      Array.from(
        new Set(ingredients.map((i) => i.supplier).filter((s): s is string => Boolean(s))),
      ).sort(),
    [],
  );

  const filtered = ingredients.filter((i) => {
    if (type !== "all" && i.type !== type) return false;
    if (supplier !== "all" && i.supplier !== supplier) return false;
    if (spikeOnly === "spike" && !i.spike) return false;
    if (spikeOnly === "stable" && i.spike) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <AppShell>
      <PageHeader
        title="Ingredients"
        description={`${ingredients.length} ingredients across Primary, Intermediate, and Fixed types.`}
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
                  Database connection required in next phase.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button size="sm" onClick={() => setDrawerOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Ingredient
            </Button>
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
            <SelectItem value="Primary">Primary</SelectItem>
            <SelectItem value="Intermediate">Intermediate</SelectItem>
            <SelectItem value="Fixed">Fixed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={supplier} onValueChange={setSupplier}>
          <SelectTrigger className="h-9 w-56">
            <SelectValue placeholder="Supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={spikeOnly} onValueChange={setSpikeOnly}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any status</SelectItem>
            <SelectItem value="spike">Spike</SelectItem>
            <SelectItem value="stable">Stable</SelectItem>
          </SelectContent>
        </Select>
        <p className="ml-auto text-xs text-muted-foreground">
          Showing {filtered.length} of {ingredients.length}
        </p>
      </FilterBar>

      <div className="p-6">
        <div className="overflow-hidden rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingredient</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Original cost</TableHead>
                <TableHead className="text-right">Original qty</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead>Recipe UoM</TableHead>
                <TableHead className="text-right">Adjustment</TableHead>
                <TableHead className="text-right">Recipe unit cost</TableHead>
                <TableHead className="text-right">Last change</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-12">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Database className="h-6 w-6 text-muted-foreground" />
                      <p className="text-sm font-medium">No ingredients match these filters.</p>
                      <p className="text-xs text-muted-foreground">
                        Try clearing filters or adjusting search.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((i) => (
                  <TableRow key={i.id}>
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
                      <IngredientTypeBadge type={i.type} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {i.supplier ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {i.type === "Intermediate" ? "—" : `$${i.total_cost.toFixed(2)}`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {i.original_qty.toLocaleString("en-US")}
                    </TableCell>
                    <TableCell>
                      <UomBadge uom={i.original_uom} />
                    </TableCell>
                    <TableCell>
                      <UomBadge uom={i.recipe_uom} />
                    </TableCell>
                    <TableCell className="text-right">
                      <PercentCell value={i.adjustment} signed decimals={1} />
                    </TableCell>
                    <TableCell className="text-right">
                      <UnitCostCell value={i.recipe_unit_cost} decimals={4} />
                    </TableCell>
                    <TableCell className="text-right">
                      {i.last_change_pct === null || i.last_change_pct === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <PercentCell value={i.last_change_pct} signed decimals={2} />
                      )}
                    </TableCell>
                    <TableCell>
                      <SpikeBadge active={i.spike} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Add Ingredient</SheetTitle>
            <SheetDescription>
              Mock form — values are not saved in this build.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="ing-name">Name</Label>
              <Input id="ing-name" placeholder="e.g., Pecorino Romano" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select defaultValue="Primary">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Primary">Primary</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ing-sup">Supplier</Label>
                <Input id="ing-sup" placeholder="Supplier name" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ing-qty">Original qty</Label>
                <Input id="ing-qty" type="number" min={0.01} step={0.01} placeholder="1" />
              </div>
              <div className="space-y-1.5">
                <Label>Original UoM</Label>
                <Select defaultValue="Kg">
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
                <Label htmlFor="ing-cost">Total cost (USD)</Label>
                <Input id="ing-cost" type="number" min={0} step={0.01} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Recipe UoM</Label>
                <Select defaultValue="Gr">
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
                <Label htmlFor="ing-adj">Adjustment</Label>
                <Input id="ing-adj" type="number" step={0.01} placeholder="0.00" />
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.info("Mock UI — ingredient was not saved.");
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
