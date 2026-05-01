import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDataIntegrityReport, type IntegritySeverity } from "@/data/selectors";

export const Route = createFileRoute("/qa-data-integrity")({
  head: () => ({
    meta: [
      { title: "Data Integrity QA — Margin IQ" },
      {
        name: "description",
        content: "Pass/warning/fail checks for derived data and references.",
      },
    ],
  }),
  component: QaIntegrityPage,
});

function severityBadge(s: IntegritySeverity) {
  if (s === "pass")
    return (
      <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
        Pass
      </Badge>
    );
  if (s === "warning")
    return (
      <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
        Warning
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="border-destructive/30 bg-destructive/10 text-destructive"
    >
      Fail
    </Badge>
  );
}

function QaIntegrityPage() {
  const report = useMemo(() => getDataIntegrityReport(), []);

  return (
    <AppShell>
      <PageHeader
        title="Data Integrity QA"
        description="Reference, uniqueness, and derived-data integrity checks. Pure helpers, no persistence."
      />
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant="outline"
            className="border-success/30 bg-success/10 text-success"
          >
            {report.passing} passing
          </Badge>
          <Badge
            variant="outline"
            className={
              report.warning > 0
                ? "border-warning/30 bg-warning/10 text-warning"
                : "text-muted-foreground"
            }
          >
            {report.warning} warning
          </Badge>
          <Badge
            variant="outline"
            className={
              report.failing > 0
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "text-muted-foreground"
            }
          >
            {report.failing} failing
          </Badge>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Checks</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Check</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead className="w-32">Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.checks.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.message}
                    </TableCell>
                    <TableCell>{severityBadge(c.severity)}</TableCell>
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
