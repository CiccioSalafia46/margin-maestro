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
        content: "Per-dish profitability: COGS, GP, GPM, target status, and snapshot delta.",
      },
    ],
  }),
  component: MenuAnalyticsPage,
});

function MenuAnalyticsPage() {
  const [belowOnly, setBelowOnly] = useState(false);
  const [category, setCategory] = useState("all");
  const [onMenu, setOnMenu] = useState("all");

  const dishMetrics = useMemo(
    () =>
      recipes
        .filter((r) => r.type === "Dish")
        .map((r) => ({ recipe: r, metrics: computeRecipeMetrics(r) })),
    [],
  );

  const categories = useMemo(
    () => Array.from(new Set(dishMetrics.map((d) => d.recipe.category))).sort(),
    [dishMetrics],
  );

  const filtered = dishMetrics.filter((d) => {
    if (belowOnly && d.metrics.on_target) return false;
    if (category !== "all" && d.recipe.category !== category) return false;
    if (onMenu === "yes" && !d.recipe.on_menu) return false;
    if (onMenu === "no" && d.recipe.on_menu) return false;
    return true;
  });

  const onMenuRows = dishMetrics.filter((d) => d.recipe.on_menu);
  const gpms = onMenuRows
    .map((d) => d.metrics.gpm)
    .filter((g): g is number => g !== null);
  const gps = onMenuRows.map((d) => d.metrics.gp).filter((g): g is number => g !== null);
  const avgGpm = gpms.length ? gpms.reduce((a, b) => a + b, 0) / gpms.length : null;
  const avgGp = gps.length ? gps.reduce((a, b) => a + b, 0) / gps.length : null;

  const sortedByGpm = [...onMenuRows]
    .filter((d) => d.metrics.gpm !== null)
    .sort((a, b) => (b.metrics.gpm ?? 0) - (a.metrics.gpm ?? 0));
  const top = sortedByGpm[0];
  const bottom = sortedByGpm[sortedByGpm.length - 1];
  const belowCount = onMenuRows.filter((d) => !d.metrics.on_target).length;

  return (
    <AppShell>
      <PageHeader
        title="Menu Analytics"
        description={`Target GPM ${(TARGET_GPM * 100).toFixed(0)}%. Sort by worst margin first.`}
      />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Average GPM"
            value={<PercentCell value={avgGpm} decimals={1} />}
            tone={avgGpm !== null && avgGpm >= TARGET_GPM ? "positive" : "warning"}
            hint={`Target ${(TARGET_GPM * 100).toFixed(0)}%`}
          />
          <KpiCard label="Average GP" value={<MoneyCell value={avgGp} />} hint="Per cover" />
          <KpiCard
            label="Top performer"
            value={top ? <span className="text-base">{top.recipe.name}</span> : "—"}
            hint={top ? <PercentCell value={top.metrics.gpm} /> : ""}
            tone="positive"
          />
          <KpiCard
            label="Bottom performer"
            value={bottom ? <span className="text-base">{bottom.recipe.name}</span> : "—"}
            hint={bottom ? <PercentCell value={bottom.metrics.gpm} /> : ""}
            tone="negative"
          />
          <KpiCard
            label="Dishes below target"
            value={belowCount}
            tone={belowCount > 0 ? "negative" : "positive"}
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
          {filtered.length} of {dishMetrics.length} dishes
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
                <TableHead className="text-right">Δ vs snapshot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered
                .sort((a, b) => (a.metrics.gpm ?? 1) - (b.metrics.gpm ?? 1))
                .map(({ recipe, metrics }) => (
                  <TableRow key={recipe.id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/dish-analysis/$id"
                        params={{ id: recipe.id }}
                        className="hover:underline"
                      >
                        {recipe.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {recipe.category}
                    </TableCell>
                    <TableCell>
                      {recipe.on_menu ? (
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
                      {recipe.menu_price === null || recipe.menu_price === 0 ? (
                        <span className="text-xs italic text-muted-foreground">
                          Set menu price
                        </span>
                      ) : (
                        <MoneyCell value={recipe.menu_price} />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyCell value={metrics.cogs} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyCell value={metrics.gp} />
                    </TableCell>
                    <TableCell className="text-right">
                      <PercentCell value={metrics.gpm} />
                    </TableCell>
                    <TableCell>
                      <OnTargetBadge onTarget={metrics.on_target} />
                    </TableCell>
                    <TableCell className="text-right">
                      <PpDeltaCell value={recipe.delta_gpm_vs_snapshot} />
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
