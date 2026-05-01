import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { EmptyState } from "@/components/common/EmptyState";
import {
  AlertSeverityBadge,
  AlertStatusBadge,
} from "@/components/common/badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getRecipeById, getIngredientById } from "@/data/mock";
import { getAlerts } from "@/data/selectors";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — Margin IQ" },
      {
        name: "description",
        content: "Margin alerts: dishes below target, ingredient spikes, intermediate cost shifts.",
      },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const [severity, setSeverity] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [openAlert, setOpenAlert] = useState<AlertItem | null>(null);

  const filtered = useMemo(
    () =>
      alerts
        .filter((a) => {
          if (severity !== "all" && a.severity !== severity) return false;
          if (type !== "all" && a.type !== type) return false;
          if (status !== "all" && a.status !== status) return false;
          return true;
        })
        .sort((a, b) => {
          const sevRank = { critical: 0, warning: 1, info: 2 } as const;
          if (sevRank[a.severity] !== sevRank[b.severity])
            return sevRank[a.severity] - sevRank[b.severity];
          return b.created_at.localeCompare(a.created_at);
        }),
    [severity, type, status],
  );

  return (
    <AppShell>
      <PageHeader
        title="Alerts"
        description="Issues the platform thinks you should look at."
      />

      <FilterBar>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-9 w-56">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="dish_below_target">Dish below target</SelectItem>
            <SelectItem value="ingredient_spike">Ingredient spike</SelectItem>
            <SelectItem value="dish_needs_price_review">Needs price review</SelectItem>
            <SelectItem value="intermediate_cost_shift">Intermediate cost shift</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <p className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {alerts.length}
        </p>
      </FilterBar>

      <div className="space-y-3 p-6">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-6 w-6" />}
            title="No alerts match these filters"
          />
        ) : (
          filtered.map((a) => (
            <Card
              key={a.id}
              className="cursor-pointer transition-colors hover:bg-muted/30"
              onClick={() => setOpenAlert(a)}
            >
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertSeverityBadge severity={a.severity} />
                    <AlertStatusBadge status={a.status} />
                    <p className="font-medium">{a.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.summary}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDateTime(a.created_at)}
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  View details
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Sheet open={openAlert !== null} onOpenChange={(o) => !o && setOpenAlert(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {openAlert && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <AlertSeverityBadge severity={openAlert.severity} />
                  <AlertStatusBadge status={openAlert.status} />
                </div>
                <SheetTitle className="mt-2">{openAlert.title}</SheetTitle>
                <SheetDescription>{openAlert.summary}</SheetDescription>
              </SheetHeader>
              <div className="space-y-3 py-4 text-sm">
                <p>
                  <span className="text-muted-foreground">Created: </span>
                  {formatDateTime(openAlert.created_at)}
                </p>
                {openAlert.affected_recipe_id && (
                  <p>
                    <span className="text-muted-foreground">Affected dish: </span>
                    {getRecipeById(openAlert.affected_recipe_id)?.name ?? "—"}
                  </p>
                )}
                {openAlert.affected_ingredient_id && (
                  <p>
                    <span className="text-muted-foreground">Affected ingredient: </span>
                    {getIngredientById(openAlert.affected_ingredient_id)?.name ?? "—"}
                  </p>
                )}
              </div>
              <SheetFooter className="flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => {
                    toast.info("Mock UI — acknowledge not persisted.");
                  }}
                >
                  Acknowledge
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    toast.success("Mock UI — resolve not persisted.");
                  }}
                >
                  Resolve
                </Button>
                <Button
                  onClick={() => {
                    toast.info("Mock UI — navigation only.");
                  }}
                >
                  View affected dish
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
