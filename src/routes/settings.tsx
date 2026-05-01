import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { restaurantSettings } from "@/data/mock";
import { UomBadge } from "@/components/common/badges";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Margin IQ" },
      { name: "description", content: "Restaurant, units, categories, alert thresholds, team." },
    ],
  }),
  component: SettingsPage,
});

const mockTeam = [
  { name: "Operator (you)", email: "demo@margin-iq.app", role: "Owner" },
  { name: "Sous Chef", email: "chef@margin-iq.app", role: "Editor" },
  { name: "Bookkeeper", email: "books@margin-iq.app", role: "Viewer" },
];

const mockCategories = ["Antipasti", "Pasta", "Pizza", "Secondi", "Base"];

function SettingsPage() {
  const [tab, setTab] = useState("general");

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        description="Restaurant configuration. Mock UI — changes are not persisted."
      />
      <div className="p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="units">Units &amp; Conversions</TabsTrigger>
            <TabsTrigger value="categories">Menu Categories</TabsTrigger>
            <TabsTrigger value="thresholds">Alert Thresholds</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Restaurant profile</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Restaurant name" defaultValue={restaurantSettings.restaurant_name} />
                <Field label="Currency" defaultValue={restaurantSettings.currency} disabled />
                <Field label="Locale" defaultValue={restaurantSettings.locale} disabled />
                <div className="space-y-1.5">
                  <Label>Tax mode</Label>
                  <Select defaultValue={restaurantSettings.tax_mode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ex_tax">Menu prices excluding tax</SelectItem>
                      <SelectItem value="inc_tax">Menu prices including tax</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Field
                  label="Target GPM (%)"
                  defaultValue={(restaurantSettings.target_gpm * 100).toFixed(0)}
                />
                <div />
                <div className="md:col-span-2">
                  <Button onClick={() => toast.info("Demo only — settings were not saved.")}>
                    Save changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="units" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Available units</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {restaurantSettings.units.map((u) => (
                    <UomBadge key={u} uom={u} />
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Mass↔volume conversions require ingredient density. Ct cannot be converted.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Menu categories</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {mockCategories.map((c) => (
                  <Badge key={c} variant="outline" className="text-sm">
                    {c}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="thresholds" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Alert thresholds</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Ingredient spike threshold (%)" defaultValue="10" />
                <Field label="Margin drop alert (pp)" defaultValue="3" />
                <Field label="Critical GPM gap (pp)" defaultValue="5" />
                <Field label="Lookback window (days)" defaultValue="30" />
                <div className="md:col-span-2">
                  <Button onClick={() => toast.info("Demo only — thresholds were not saved.")}>
                    Save thresholds
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Team (mock)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockTeam.map((m) => (
                      <TableRow key={m.email}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{m.role}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="mt-6 border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Developer QA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              These checks validate calculation logic and mock data integrity
              before backend integration.
            </p>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Pure-helper pass/fail checks for the calculation engine (UoM
                conversions, ingredient costing, COGS, GP/GPM, Suggested Menu
                Price, Impact Cascade pathways).
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/qa-calculations" aria-label="Open Calculation QA">
                  Calculation QA
                </Link>
              </Button>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Reference, uniqueness, and derived-data integrity checks
                (recipes, ingredients, Price Log, Snapshot, alerts, Impact
                Cascade).
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/qa-data-integrity" aria-label="Open Data Integrity QA">
                  Data Integrity QA
                </Link>
              </Button>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Authentication, tenant membership, active restaurant, and RLS
                smoke checks for the Build 1.0 backend foundation.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/qa-auth" aria-label="Open Auth QA">
                  Auth QA
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  defaultValue,
  disabled,
}: {
  label: string;
  defaultValue: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input defaultValue={defaultValue} disabled={disabled} />
    </div>
  );
}
