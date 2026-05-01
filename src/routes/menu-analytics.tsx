import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { KpiCard } from "@/components/common/KpiCard";
import {
  MoneyCell,
  OnTargetBadge,
  PercentCell,
  PpDeltaCell,
} from "@/components/common/badges";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { TARGET_GPM } from "@/data/mock";
import { getMenuAnalyticsRows, getMenuBenchmarks } from "@/data/selectors";

export const Route = createFileRoute("/menu-analytics")({
  head: () => ({
    meta: [
      { title: "Menu Analytics — Margin IQ" },
      {
        name: "description",
        content: "Per-dish profitability: COGS, GP, GPM, target status, derived snapshot delta.",
      },
    ],
  }),
  component: MenuAnalyticsPage,
});

function MenuAnalyticsPage() {
  const [belowOnly, setBelowOnly] = useState(false);
  const [category, setCategory] = useState("all");
  const [onMenu, setOnMenu] = useState("all");

  const rows = useMemo(() => getMenuAnalyticsRows(), []);
  const bench = useMemo(() => getMenuBenchmarks(), []);

  const categories = useMemo(
    () => Array.from(new Set(rows.map((d) => d.recipe.category))).sort(),
    [rows],
  );

  const filtered = rows.filter((d) => {
    if (belowOnly && d.on_target) return false;
    if (category !== "all" && d.recipe.category !== category) return false;
    if (onMenu === "yes" && !d.recipe.on_menu) return false;
    if (onMenu === "no" && d.recipe.on_menu) return false;
    return true;
  });

  return (
    <AppShell>
      <PageHeader
        title="Menu Analytics"
        description={`Target GPM ${(TARGET_GPM * 100).toFixed(0)}%. Δ vs last confirmed snapshot. Off-menu dishes excluded from benchmarks.`}
      />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Average GPM"
            value={<PercentCell value={bench.avg_gpm} decimals={1} />}
            tone={bench.avg_gpm !== null && bench.avg_gpm >= TARGET_GPM ? "positive" : "warning"}
            hint={`Target ${(TARGET_GPM * 100).toFixed(0)}% • ${bench.on_menu_count} on menu`}
          />
          <KpiCard label="Average GP" value={<MoneyCell value={bench.avg_gp} />} hint="Per cover" />
          <KpiCard
            label="Top performer"
            value={bench.top ? <span className="text-base">{bench.top.recipe.name}</span> : "—"}
            hint={bench.top ? <PercentCell value={bench.top.gpm} /> : ""}
            tone="positive"
          />
          <KpiCard
            label="Bottom performer"
            value={bench.bottom ? <span className="text-base">{bench.bottom.recipe.name}</span> : "—"}
            hint={bench.bottom ? <PercentCell value={bench.bottom.gpm} /> : ""}
            tone="negative"
          />
          <KpiCard
            label="Dishes below target"
            value={bench.below_target_count}
            tone={bench.below_target_count > 0 ? "negative" : "positive"}
          />
        </div>
      </div>

      <FilterBar>
        <div className="flex items-center gap-2">
          <Switch id="below" checked={belowOnly} onCheckedChange={setBelowOnly} />
          <Label htmlFor="below" className="cursor-pointer">
            Below target only
          </Label>
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={onMenu} onValueChange={setOnMenu}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="On menu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any</SelectItem>
            <SelectItem value="yes">On menu</SelectItem>
            <SelectItem value="no">Off menu</SelectItem>
          </SelectContent>
        </Select>
        <p className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {rows.length} dishes
        </p>
      </FilterBar>

      <div className="p-6 pt-4">
        <div className="overflow-hidden rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dish</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>On menu</TableHead>
                <TableHead className="text-right">Menu price</TableHead>
                <TableHead className="text-right">COGS</TableHead>
                <TableHead className="text-right">GP</TableHead>
                <TableHead className="text-right">GPM</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="text-right">Δ COGS</TableHead>
                <TableHead className="text-right">Δ GPM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...filtered]
                .sort((a, b) => (a.gpm ?? 1) - (b.gpm ?? 1))
                .map((row) => (
                  <TableRow key={row.recipe.id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/dish-analysis/$id"
                        params={{ id: row.recipe.id }}
                        className="hover:underline"
                      >
                        {row.recipe.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.recipe.category}
                    </TableCell>
                    <TableCell>
                      {row.recipe.on_menu ? (
                        <Badge
                          variant="outline"
                          className="border-success/30 bg-success/10 text-success"
                        >
                          On
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Off
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.recipe.menu_price === null || row.recipe.menu_price === 0 ? (
                        <span className="text-xs italic text-muted-foreground">
                          Set menu price
                        </span>
                      ) : (
                        <MoneyCell value={row.recipe.menu_price} />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyCell value={row.cost_per_serving} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyCell value={row.gp} />
                    </TableCell>
                    <TableCell className="text-right">
                      <PercentCell value={row.gpm} />
                    </TableCell>
                    <TableCell>
                      <OnTargetBadge onTarget={row.on_target} />
                    </TableCell>
                    <TableCell className="text-right">
                      {row.delta_cogs_vs_snapshot === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={
                            row.delta_cogs_vs_snapshot > 0
                              ? "tabular-nums text-destructive"
                              : row.delta_cogs_vs_snapshot < 0
                                ? "tabular-nums text-success"
                                : "tabular-nums text-muted-foreground"
                          }
                        >
                          {row.delta_cogs_vs_snapshot > 0 ? "+" : ""}
                          {row.delta_cogs_vs_snapshot.toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <PpDeltaCell value={row.delta_gpm_vs_snapshot} />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
