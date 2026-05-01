import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { KpiCard } from "@/components/common/KpiCard";
import { PercentCell, UnitCostCell } from "@/components/common/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ingredients, priceLog } from "@/data/mock";
import { formatDate, formatDateTime, formatUnitCost } from "@/lib/format";

export const Route = createFileRoute("/price-trend")({
  head: () => ({
    meta: [
      { title: "Price Trend — Margin IQ" },
      {
        name: "description",
        content: "Per-ingredient unit cost history with batch annotations and key statistics.",
      },
    ],
  }),
  component: PriceTrendPage,
});

function PriceTrendPage() {
  const tracked = ingredients.filter((i) => i.type !== "Intermediate");
  const [selectedId, setSelectedId] = useState(
    ingredients.find((i) => i.id === "ing-sundried-tomatoes")?.id ?? tracked[0]?.id ?? "",
  );

  const entries = useMemo(
    () =>
      priceLog
        .filter((p) => p.ingredient_id === selectedId)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [selectedId],
  );

  const first = entries[0]?.new_unit_cost ?? null;
  const current = entries[entries.length - 1]?.new_unit_cost ?? null;
  const absChange = first !== null && current !== null ? current - first : null;
  const pctChange = first !== null && current !== null && first !== 0 ? (current - first) / first : null;
  const changeEntries = entries.filter((e) => e.event === "change");
  const changeCount = changeEntries.length;
  const largestIncreasePct =
    changeEntries.length > 0
      ? changeEntries.reduce(
          (m, e) => (e.pct_change !== null && e.pct_change > m ? e.pct_change : m),
          -Infinity,
        )
      : null;
  const largestIncrease =
    largestIncreasePct !== null && Number.isFinite(largestIncreasePct) ? largestIncreasePct : null;

  const chartData = entries.map((e) => ({
    date: formatDate(e.timestamp),
    cost: Number(e.new_unit_cost.toFixed(6)),
  }));

  return (
    <AppShell>
      <PageHeader
        title="Price Trend"
        description="Track an ingredient's unit cost across batches."
        actions={
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="h-9 w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tracked.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <KpiCard label="First recorded" value={<UnitCostCell value={first} decimals={6} />} />
          <KpiCard label="Current" value={<UnitCostCell value={current} decimals={6} />} />
          <KpiCard
            label="Absolute change"
            value={<UnitCostCell value={absChange} decimals={6} />}
            tone={absChange !== null && absChange > 0 ? "negative" : "positive"}
          />
          <KpiCard
            label="Percent change"
            value={<PercentCell value={pctChange} signed decimals={2} />}
            tone={pctChange !== null && pctChange > 0 ? "negative" : "positive"}
          />
          <KpiCard label="Number of changes" value={changeCount} />
          <KpiCard
            label="Largest increase"
            value={<PercentCell value={largestIncrease} signed decimals={2} />}
            tone={largestIncrease !== null && largestIncrease > 0 ? "negative" : "positive"}
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Unit cost over time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              {chartData.length < 2 ? (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Not enough data points to render a chart.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => formatUnitCost(v as number, 4)}
                      width={90}
                    />
                    <RTooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                      formatter={(v) => formatUnitCost(v as number, 6)}
                    />
                    <Line
                      type="monotone"
                      dataKey="cost"
                      stroke="var(--color-chart-1)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "var(--color-chart-1)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Price history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Old</TableHead>
                  <TableHead className="text-right">New</TableHead>
                  <TableHead className="text-right">% change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(e.timestamp)}
                    </TableCell>
                    <TableCell className="text-sm capitalize">{e.event}</TableCell>
                    <TableCell className="text-right">
                      <UnitCostCell value={e.old_unit_cost} decimals={6} />
                    </TableCell>
                    <TableCell className="text-right">
                      <UnitCostCell value={e.new_unit_cost} decimals={6} />
                    </TableCell>
                    <TableCell className="text-right">
                      {e.pct_change === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <PercentCell value={e.pct_change} signed decimals={2} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
