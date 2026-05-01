import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import {
  PercentCell,
  SignedMoneyCell,
  UnitCostCell,
} from "@/components/common/badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ingredients, priceBatches, priceLog } from "@/data/mock";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/price-log")({
  head: () => ({
    meta: [
      { title: "Price Log — Margin IQ" },
      {
        name: "description",
        content: "Append-only audit log of every supplier price change with name_at_time.",
      },
    ],
  }),
  component: PriceLogPage,
});

function PriceLogPage() {
  const [ingredient, setIngredient] = useState("all");
  const [batch, setBatch] = useState("all");
  const [event, setEvent] = useState("all");
  const [date, setDate] = useState("");

  const filtered = useMemo(
    () =>
      priceLog
        .filter((p) => {
          if (ingredient !== "all" && p.ingredient_id !== ingredient) return false;
          if (batch !== "all" && p.batch_id !== batch) return false;
          if (event !== "all" && p.event !== event) return false;
          if (date && !p.timestamp.startsWith(date)) return false;
          return true;
        })
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [ingredient, batch, event, date],
  );

  return (
    <AppShell>
      <PageHeader
        title="Price Log"
        description="Append-only history. Records cannot be edited or deleted."
        actions={
          <Badge
            variant="outline"
            className="border-info/30 bg-info/10 text-info font-medium"
          >
            <Lock className="mr-1 h-3 w-3" /> Read-only
          </Badge>
        }
      />

      <FilterBar>
        <Select value={ingredient} onValueChange={setIngredient}>
          <SelectTrigger className="h-9 w-56">
            <SelectValue placeholder="Ingredient" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ingredients</SelectItem>
            {ingredients.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={batch} onValueChange={setBatch}>
          <SelectTrigger className="h-9 w-64">
            <SelectValue placeholder="Batch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All batches</SelectItem>
            {priceBatches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={event} onValueChange={setEvent}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Event" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            <SelectItem value="baseline">Baseline</SelectItem>
            <SelectItem value="change">Change</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 w-44"
          placeholder="Date"
        />
        <p className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {priceLog.length} entries
        </p>
      </FilterBar>

      <div className="p-6">
        <div className="overflow-hidden rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Ingredient (at time)</TableHead>
                <TableHead>Supplier (at time)</TableHead>
                <TableHead className="text-right">Old unit cost</TableHead>
                <TableHead className="text-right">New unit cost</TableHead>
                <TableHead className="text-right">Δ</TableHead>
                <TableHead className="text-right">% change</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="text-right">Baseline</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const batchLabel =
                  priceBatches.find((b) => b.id === p.batch_id)?.label ?? p.batch_id;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(p.timestamp)}
                    </TableCell>
                    <TableCell className="text-sm">{batchLabel}</TableCell>
                    <TableCell className="font-medium">{p.name_at_time}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.supplier_at_time ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <UnitCostCell value={p.old_unit_cost} decimals={6} />
                    </TableCell>
                    <TableCell className="text-right">
                      <UnitCostCell value={p.new_unit_cost} decimals={6} />
                    </TableCell>
                    <TableCell className="text-right">
                      {p.event === "baseline" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <SignedMoneyCell value={p.delta} />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.pct_change === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <PercentCell value={p.pct_change} signed decimals={2} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          p.event === "baseline"
                            ? "border-muted-foreground/30 text-muted-foreground capitalize"
                            : "border-info/30 bg-info/10 text-info capitalize"
                        }
                      >
                        {p.event}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      v{p.baseline_version}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.notes ?? ""}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
