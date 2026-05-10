import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Power } from "lucide-react";

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
import { useAuth } from "@/auth/AuthProvider";
import {
  createMenuCategory,
  createSupplier,
  getMenuCategories,
  getRestaurantSettings,
  getSuppliers,
  getUnitConversions,
  getUnits,
  updateMenuCategory,
  updateRestaurantName,
  updateRestaurantSettings,
  updateSupplier,
} from "@/data/api/settingsApi";
import type {
  ApiError,
  MenuCategoryRow,
  RestaurantSettingsRow,
  SupplierRow,
  UnitConversionRow,
  UnitRow,
} from "@/data/api/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Margin IQ" },
      { name: "description", content: "Restaurant, units, categories, alert thresholds, team." },
    ],
  }),
  component: SettingsPage,
});

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as ApiError).message);
  return e instanceof Error ? e.message : "Something went wrong.";
}

function SettingsPage() {
  const { activeMembership, activeRestaurantId, refreshTenants } = useAuth();
  const [tab, setTab] = useState("general");

  if (!activeMembership || !activeRestaurantId) {
    return (
      <AppShell>
        <PageHeader title="Settings" description="Restaurant configuration." />
        <div className="p-6">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No active restaurant. Please complete onboarding.
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const role = activeMembership.role;
  const canEditSettings = role === "owner";
  const canManageReference = role === "owner" || role === "manager";

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        description="Restaurant configuration. Settings/Admin reference data is now backed by Supabase."
      />
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="uppercase tracking-wider">
            Role: {role}
          </Badge>
          {!canEditSettings && (
            <span className="text-muted-foreground">
              Read-only for restaurant settings (owner only).
            </span>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="units">Units &amp; Conversions</TabsTrigger>
            <TabsTrigger value="categories">Menu Categories</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            <TabsTrigger value="thresholds">Alert Thresholds</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="import-export">Import / Export</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4">
            <GeneralTab
              restaurantId={activeRestaurantId}
              restaurantName={activeMembership.restaurant.name}
              canEdit={canEditSettings}
              onRestaurantChanged={refreshTenants}
            />
          </TabsContent>

          <TabsContent value="units" className="mt-4">
            <UnitsTab />
          </TabsContent>

          <TabsContent value="categories" className="mt-4">
            <CategoriesTab restaurantId={activeRestaurantId} canManage={canManageReference} />
          </TabsContent>

          <TabsContent value="suppliers" className="mt-4">
            <SuppliersTab restaurantId={activeRestaurantId} canManage={canManageReference} />
          </TabsContent>

          <TabsContent value="thresholds" className="mt-4">
            <ThresholdsTab restaurantId={activeRestaurantId} canEdit={canEditSettings} />
          </TabsContent>

          <TabsContent value="team" className="mt-4">
            <TeamTab restaurantId={activeRestaurantId} canManage={canEditSettings} />
          </TabsContent>

          <TabsContent value="billing" className="mt-4">
            <BillingTab restaurantId={activeRestaurantId} canManage={canEditSettings} />
          </TabsContent>

          <TabsContent value="import-export" className="mt-4">
            <ImportExportTab restaurantId={activeRestaurantId} canManage={canManageReference} />
          </TabsContent>
        </Tabs>

        <DeveloperQa />
      </div>
    </AppShell>
  );
}

// ----------------- General -----------------
function GeneralTab({
  restaurantId,
  restaurantName,
  canEdit,
  onRestaurantChanged,
}: {
  restaurantId: string;
  restaurantName: string;
  canEdit: boolean;
  onRestaurantChanged: () => Promise<void>;
}) {
  const [settings, setSettings] = useState<RestaurantSettingsRow | null>(null);
  const [name, setName] = useState(restaurantName);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getRestaurantSettings(restaurantId)
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch((e) => !cancelled && setError(errMsg(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  useEffect(() => setName(restaurantName), [restaurantName]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings || !canEdit) return;
    setSaving(true);
    try {
      if (name.trim() && name.trim() !== restaurantName) {
        await updateRestaurantName(restaurantId, name);
      }
      const updated = await updateRestaurantSettings(restaurantId, {
        currency_code: settings.currency_code,
        locale: settings.locale,
        timezone: settings.timezone,
        tax_mode: settings.tax_mode,
        target_gpm: settings.target_gpm,
      });
      setSettings(updated);
      await onRestaurantChanged();
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </CardContent>
      </Card>
    );
  if (error || !settings)
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          {error ?? "Settings not found."}
        </CardContent>
      </Card>
    );

  const disabled = !canEdit || saving;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Restaurant profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSave} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="r_name">Restaurant name</Label>
            <Input
              id="r_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Input
              value={settings.currency_code}
              onChange={(e) => setSettings({ ...settings, currency_code: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Locale</Label>
            <Input
              value={settings.locale}
              onChange={(e) => setSettings({ ...settings, locale: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Input
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tax mode</Label>
            <Select
              value={settings.tax_mode}
              onValueChange={(v) =>
                setSettings({ ...settings, tax_mode: v as "ex_tax" | "inc_tax" })
              }
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ex_tax">Menu prices excluding tax</SelectItem>
                <SelectItem value="inc_tax">Menu prices including tax</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Target GPM (%)</Label>
            <Input
              type="number"
              step="1"
              min="0"
              max="100"
              value={Math.round(settings.target_gpm * 100)}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  target_gpm: Math.max(0, Math.min(100, Number(e.target.value || 0))) / 100,
                })
              }
              disabled={disabled}
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={disabled}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ----------------- Units -----------------
function UnitsTab() {
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [conv, setConv] = useState<UnitConversionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getUnits(), getUnitConversions()])
      .then(([u, c]) => {
        if (!cancelled) {
          setUnits(u);
          setConv(c);
        }
      })
      .catch((e) => !cancelled && setError(errMsg(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading)
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </CardContent>
      </Card>
    );
  if (error)
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
      </Card>
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available units</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Family</TableHead>
                <TableHead>Base unit</TableHead>
                <TableHead className="text-right">To-base factor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((u) => (
                <TableRow key={u.code}>
                  <TableCell className="font-mono text-xs">{u.code}</TableCell>
                  <TableCell>{u.label}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{u.family}</TableCell>
                  <TableCell className="font-mono text-xs">{u.base_unit_code ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {u.to_base_factor ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Same-family conversions are seeded automatically. Mass↔volume conversions require
            ingredient density and are not seeded as defaults. Ct only converts to Ct. Units are
            global reference data — custom unit management will be added later.
          </p>
          <p className="text-xs text-muted-foreground">
            {conv.length} conversion rule(s) loaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ----------------- Categories -----------------
function CategoriesTab({
  restaurantId,
  canManage,
}: {
  restaurantId: string;
  canManage: boolean;
}) {
  const [rows, setRows] = useState<MenuCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await getMenuCategories(restaurantId));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Category name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const max = rows.reduce((m, r) => Math.max(m, r.sort_order), 0);
      await createMenuCategory(restaurantId, { name, sort_order: max + 10 });
      setName("");
      toast.success("Category added.");
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onRename = async (id: string, current: string) => {
    const next = window.prompt("New category name", current);
    if (next === null) return;
    try {
      await updateMenuCategory(id, { name: next });
      toast.success("Category renamed.");
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const onToggle = async (row: MenuCategoryRow) => {
    try {
      await updateMenuCategory(row.id, { is_active: !row.is_active });
      toast.success(row.is_active ? "Category deactivated." : "Category activated.");
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Menu categories</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <form onSubmit={onAdd} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="cat_name">New category</Label>
              <Input
                id="cat_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tasting Menu"
              />
            </div>
            <Button type="submit" disabled={submitting}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-24">Order</TableHead>
                <TableHead className="w-28">Status</TableHead>
                {canManage && <TableHead className="w-44 text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={r.is_active ? "" : "opacity-60"}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={r.is_active ? "default" : "outline"}>
                      {r.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="space-x-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => onRename(r.id, r.name)}>
                        Rename
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onToggle(r)}>
                        <Power className="mr-1 h-3.5 w-3.5" />
                        {r.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------- Suppliers -----------------
function SuppliersTab({
  restaurantId,
  canManage,
}: {
  restaurantId: string;
  canManage: boolean;
}) {
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", contact_name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await getSuppliers(restaurantId));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Supplier name is required.");
      return;
    }
    setSubmitting(true);
    try {
      await createSupplier(restaurantId, form);
      setForm({ name: "", contact_name: "", email: "", phone: "" });
      toast.success("Supplier added.");
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onToggle = async (row: SupplierRow) => {
    try {
      await updateSupplier(row.id, { is_active: !row.is_active });
      toast.success(row.is_active ? "Supplier deactivated." : "Supplier activated.");
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const onRename = async (row: SupplierRow) => {
    const next = window.prompt("New supplier name", row.name);
    if (next === null) return;
    try {
      await updateSupplier(row.id, { name: next });
      toast.success("Supplier renamed.");
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Suppliers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <form onSubmit={onAdd} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact</Label>
              <Input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="md:col-span-4">
              <Button type="submit" disabled={submitting}>
                <Plus className="mr-1 h-4 w-4" /> Add supplier
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No suppliers yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-24">Status</TableHead>
                {canManage && <TableHead className="w-44 text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={r.is_active ? "" : "opacity-60"}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.contact_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.email ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.is_active ? "default" : "outline"}>
                      {r.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="space-x-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => onRename(r)}>
                        Rename
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onToggle(r)}>
                        <Power className="mr-1 h-3.5 w-3.5" />
                        {r.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-[11px] text-muted-foreground">
          Suppliers are not yet linked to ingredients — that arrives with the Ingredients build.
        </p>
      </CardContent>
    </Card>
  );
}

// ----------------- Thresholds -----------------
function ThresholdsTab({
  restaurantId,
  canEdit,
}: {
  restaurantId: string;
  canEdit: boolean;
}) {
  const [settings, setSettings] = useState<RestaurantSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRestaurantSettings(restaurantId)
      .then((s) => !cancelled && setSettings(s))
      .catch((e) => !cancelled && toast.error(errMsg(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings || !canEdit) return;
    setSaving(true);
    try {
      const updated = await updateRestaurantSettings(restaurantId, {
        ingredient_spike_threshold_percent: settings.ingredient_spike_threshold_percent,
        gpm_drop_threshold_percent: settings.gpm_drop_threshold_percent,
        gp_floor_amount: settings.gp_floor_amount,
        target_gpm: settings.target_gpm,
      });
      setSettings(updated);
      toast.success("Thresholds saved.");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </CardContent>
      </Card>
    );
  if (!settings)
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No settings row found.
        </CardContent>
      </Card>
    );

  const disabled = !canEdit || saving;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alert thresholds</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSave} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NumField
            label="Ingredient spike threshold (%)"
            value={settings.ingredient_spike_threshold_percent * 100}
            onChange={(v) =>
              setSettings({ ...settings, ingredient_spike_threshold_percent: v / 100 })
            }
            disabled={disabled}
          />
          <NumField
            label="GPM drop threshold (pp)"
            value={settings.gpm_drop_threshold_percent * 100}
            onChange={(v) => setSettings({ ...settings, gpm_drop_threshold_percent: v / 100 })}
            disabled={disabled}
          />
          <NumField
            label="GP floor amount (currency)"
            value={settings.gp_floor_amount ?? 0}
            onChange={(v) => setSettings({ ...settings, gp_floor_amount: v })}
            disabled={disabled}
          />
          <NumField
            label="Target GPM (%)"
            value={Math.round(settings.target_gpm * 100)}
            onChange={(v) =>
              setSettings({ ...settings, target_gpm: Math.max(0, Math.min(100, v)) / 100 })
            }
            disabled={disabled}
          />
          <div className="md:col-span-2">
            <Button type="submit" disabled={disabled}>
              {saving ? "Saving…" : "Save thresholds"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function NumField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        disabled={disabled}
      />
    </div>
  );
}

// ----------------- Team -----------------
function TeamTab({ restaurantId, canManage }: { restaurantId: string; canManage: boolean }) {
  const { userId } = useAuth();
  const [members, setMembers] = useState<import("@/data/api/types").TeamMember[]>([]);
  const [invitations, setInvitations] = useState<import("@/data/api/types").RestaurantInvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState<string>("viewer");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { getTeamMembers, getRestaurantInvitations } = await import("@/data/api/teamApi");
      const [m, i] = await Promise.all([getTeamMembers(restaurantId), getRestaurantInvitations(restaurantId)]);
      setMembers(m);
      setInvitations(i);
    } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [restaurantId]);

  const onInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSubmitting(true);
    try {
      const { createRestaurantInvitation } = await import("@/data/api/teamApi");
      const inv = await createRestaurantInvitation(restaurantId, invEmail, invRole as "owner" | "manager" | "viewer", userId);
      const link = `${window.location.origin}/accept-invite?token=${inv.token}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      toast.success("Invite link copied to clipboard! Send it to the invited user manually.", { duration: 8000 });
      setInvEmail("");
      await load();
    } catch (e) { toast.error(errMsg(e)); } finally { setSubmitting(false); }
  };

  const onCancel = async (invId: string) => {
    try {
      const { cancelRestaurantInvitation } = await import("@/data/api/teamApi");
      await cancelRestaurantInvitation(restaurantId, invId);
      toast.success("Invitation cancelled.");
      await load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const onChangeRole = async (memberUserId: string, role: string) => {
    try {
      const { updateMemberRole } = await import("@/data/api/teamApi");
      await updateMemberRole(restaurantId, memberUserId, role as "owner" | "manager" | "viewer");
      toast.success("Role updated.");
      await load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const onRemove = async (memberUserId: string) => {
    if (!window.confirm("Remove this team member?")) return;
    try {
      const { removeTeamMember } = await import("@/data/api/teamApi");
      await removeTeamMember(restaurantId, memberUserId);
      toast.success("Member removed.");
      await load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (loading) return <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</CardContent></Card>;

  const pendingInvites = invitations.filter((i) => i.status === "pending");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Team members</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Owners: full access. Managers: edit data. Viewers: read-only.</p>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead>{canManage && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell className="font-medium">{m.full_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.email ?? "—"}</TableCell>
                  <TableCell>
                    {canManage && m.user_id !== userId ? (
                      <Select value={m.role} onValueChange={(v) => onChangeRole(m.user_id, v)}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="owner">Owner</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="uppercase">{m.role}</Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {m.user_id !== userId && <Button size="sm" variant="ghost" onClick={() => onRemove(m.user_id)}>Remove</Button>}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base">Invite member</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onInvite} className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5"><Label>Email</Label><Input type="email" required value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="team@example.com" /></div>
              <div className="w-32 space-y-1.5"><Label>Role</Label>
                <Select value={invRole} onValueChange={setInvRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="owner">Owner</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectContent></Select>
              </div>
              <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create invite"}</Button>
            </form>
            <p className="mt-2 text-[11px] text-muted-foreground">Email delivery is not enabled yet. After creating an invite, copy the link and send it to the user manually. The user must sign up or log in with the invited email.</p>
          </CardContent>
        </Card>
      )}

      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pending invitations</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Sent</TableHead>{canManage && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
              <TableBody>
                {pendingInvites.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm">{inv.email}</TableCell>
                    <TableCell><Badge variant="outline" className="uppercase">{inv.role}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                    {canManage && <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => { const link = `${window.location.origin}/accept-invite?token=${inv.token}`; navigator.clipboard.writeText(link).then(() => toast.success("Invite link copied.")); }}>Copy link</Button>
                      <Button size="sm" variant="ghost" onClick={() => onCancel(inv.id)}>Cancel</Button>
                    </TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ----------------- Billing -----------------
function BillingTab({ restaurantId, canManage }: { restaurantId: string; canManage: boolean }) {
  const [summary, setSummary] = useState<import("@/data/api/types").BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { getBillingSummary } = await import("@/data/api/billingApi");
        const s = await getBillingSummary(restaurantId);
        if (!cancelled) setSummary(s);
      } catch { /* billing tables may not exist yet */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [restaurantId]);

  const onCheckout = async () => {
    setActionBusy(true);
    try {
      const { createCheckoutSession } = await import("@/data/api/billingApi");
      const { url } = await createCheckoutSession(restaurantId);
      window.location.href = url;
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setActionBusy(false);
    }
  };

  const onPortal = async () => {
    setActionBusy(true);
    try {
      const { createCustomerPortalSession } = await import("@/data/api/billingApi");
      const { url } = await createCustomerPortalSession(restaurantId);
      window.location.href = url;
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) return <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</CardContent></Card>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Billing</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">Billing is managed securely through Stripe. Only owners can manage billing.</p>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p><p className="mt-0.5 font-medium capitalize">{summary?.status ?? "none"}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Plan</p><p className="mt-0.5 font-medium">{summary?.plan_key ?? "—"}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Period ends</p><p className="mt-0.5 font-medium">{summary?.current_period_end ? new Date(summary.current_period_end).toLocaleDateString() : "—"}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Email</p><p className="mt-0.5 font-medium">{summary?.billing_email ?? "—"}</p></div>
        </div>
        {summary?.cancel_at_period_end && <p className="text-xs text-destructive">Subscription will cancel at end of current period.</p>}
        {canManage && (
          <div className="flex gap-2 pt-2">
            {!summary?.has_subscription || summary.status === "none" ? (
              <Button size="sm" onClick={onCheckout} disabled={actionBusy}>{actionBusy ? "Redirecting…" : "Start subscription"}</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onPortal} disabled={actionBusy}>{actionBusy ? "Redirecting…" : "Manage billing"}</Button>
            )}
          </div>
        )}
        {!canManage && <p className="text-xs text-muted-foreground">Contact an owner to manage billing.</p>}
        <p className="text-[11px] text-muted-foreground">Subscription status is synchronized via Stripe webhooks. Checkout and billing portal require Edge Functions to be deployed with Stripe keys configured.</p>
      </CardContent>
    </Card>
  );
}

// ----------------- Import / Export -----------------
function ImportExportTab({ restaurantId, canManage }: { restaurantId: string; canManage: boolean }) {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<import("@/data/api/importExportApi").ImportPreview | null>(null);
  const [mode, setMode] = useState<"skip" | "update">("skip");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState("");

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(reader.result as string);
    reader.readAsText(file);
  };

  const onPreview = async () => {
    try {
      const { previewIngredientImport } = await import("@/data/api/importExportApi");
      const p = await previewIngredientImport(restaurantId, csvText, mode);
      setPreview(p);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const onApply = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const { applyIngredientImport } = await import("@/data/api/importExportApi");
      const result = await applyIngredientImport(restaurantId, preview);
      toast.success(`Import complete: ${result.created} created, ${result.updated} updated, ${result.errors} errors.`);
      setCsvText(""); setPreview(null);
    } catch (e) { toast.error(errMsg(e)); } finally { setImporting(false); }
  };

  const onExport = async (fn: string) => {
    setExporting(fn);
    try {
      const mod = await import("@/data/api/importExportApi");
      const fnMap: Record<string, (id: string) => Promise<void>> = {
        ingredients: mod.exportIngredientsCsv,
        recipes: mod.exportRecipesCsv,
        menuAnalytics: mod.exportMenuAnalyticsCsv,
        priceLog: mod.exportPriceLogCsv,
        alerts: mod.exportAlertsCsv,
      };
      await fnMap[fn]?.(restaurantId);
      toast.success("Export downloaded.");
    } catch (e) { toast.error(errMsg(e)); } finally { setExporting(""); }
  };

  const onDownloadTemplate = async () => {
    const { getIngredientImportTemplate } = await import("@/data/api/importExportApi");
    const blob = new Blob([getIngredientImportTemplate()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ingredient-import-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base">Import Ingredients</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onDownloadTemplate}>Download template</Button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
                Upload CSV <input type="file" accept=".csv" className="hidden" onChange={onFileChange} />
              </label>
            </div>
            {csvText && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Duplicate handling:</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as "skip" | "update")}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="skip">Skip</SelectItem><SelectItem value="update">Update</SelectItem></SelectContent></Select>
                  <Button size="sm" onClick={onPreview}>Preview</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setCsvText(""); setPreview(null); }}>Clear</Button>
                </div>
                {preview && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 text-center text-sm">
                      <div><p className="text-2xl font-semibold">{preview.creates}</p><p className="text-[10px] text-muted-foreground uppercase">Create</p></div>
                      <div><p className="text-2xl font-semibold">{preview.updates}</p><p className="text-[10px] text-muted-foreground uppercase">Update</p></div>
                      <div><p className="text-2xl font-semibold">{preview.skips}</p><p className="text-[10px] text-muted-foreground uppercase">Skip</p></div>
                      <div><p className="text-2xl font-semibold text-destructive">{preview.error}</p><p className="text-[10px] text-muted-foreground uppercase">Error</p></div>
                    </div>
                    {preview.rows.filter((r) => r.messages.length > 0).slice(0, 10).map((r) => (
                      <p key={r.row_number} className="text-xs"><span className="font-mono">Row {r.row_number}:</span> <span className={r.status === "error" ? "text-destructive" : "text-muted-foreground"}>{r.messages.join(" ")}</span></p>
                    ))}
                    <Button size="sm" onClick={onApply} disabled={importing || preview.error > 0}>
                      {importing ? "Importing…" : `Apply ${preview.creates + preview.updates} row(s)`}
                    </Button>
                    {preview.error > 0 && <p className="text-xs text-destructive">Fix error rows before applying.</p>}
                  </div>
                )}
              </>
            )}
            <p className="text-[11px] text-muted-foreground">Import does not write price log or create price update batches.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Export Data</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {[
            { key: "ingredients", label: "Ingredients" },
            { key: "recipes", label: "Recipes" },
            { key: "menuAnalytics", label: "Menu Analytics" },
            { key: "priceLog", label: "Price Log" },
            { key: "alerts", label: "Alerts" },
          ].map((e) => (
            <div key={e.key} className="flex items-center justify-between">
              <span className="text-sm">{e.label}</span>
              <Button size="sm" variant="outline" onClick={() => onExport(e.key)} disabled={!!exporting}>
                {exporting === e.key ? "Exporting…" : "Export CSV"}
              </Button>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">Exports respect RLS and include active restaurant data only. Formula-risky cells are sanitized.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ----------------- Developer QA links -----------------
function DeveloperQa() {
  return (
    <Card className="mt-2 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Developer QA</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <QaLink to="/qa-calculations" label="Calculation QA (A–S)" />
        <QaLink to="/qa-data-integrity" label="Data Integrity QA" />
        <QaLink to="/qa-auth" label="Auth & Tenancy QA" />
        <QaLink to="/qa-settings-admin" label="Settings/Admin Reference QA" />
        <QaLink to="/qa-ingredients" label="Ingredients Database QA" />
        <QaLink to="/qa-recipes" label="Recipes QA" />
        <QaLink to="/qa-menu-analytics" label="Menu Analytics QA" />
        <QaLink to="/qa-price-log-snapshot" label="Price Log + Snapshot QA" />
        <QaLink to="/qa-price-trend" label="Price Trend QA" />
        <QaLink to="/qa-dish-analysis" label="Dish Analysis QA" />
        <QaLink to="/qa-impact-cascade" label="Impact Cascade QA" />
        <QaLink to="/qa-alerts" label="Alerts QA" />
        <QaLink to="/qa-dashboard" label="Dashboard QA" />
        <QaLink to="/qa-mvp-readiness" label="MVP Readiness QA" />
        <QaLink to="/qa-team-management" label="Team Management QA" />
        <QaLink to="/qa-billing" label="Billing QA" />
        <QaLink to="/qa-apply-price" label="Apply Price QA" />
        <QaLink to="/qa-import-export" label="Import/Export QA" />
        <QaLink to="/qa-beta-launch" label="Beta Launch QA" />
        <QaLink to="/qa-monitoring" label="Monitoring QA" />
        <QaLink to="/qa-google-oauth" label="Google OAuth QA" />
        <QaLink to="/qa-live-deployment" label="Live Deployment QA" />
        <QaLink to="/qa-menu-price-audit" label="Menu Price Audit QA" />
      </CardContent>
    </Card>
  );
}

function QaLink({ to, label }: { to: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <Button asChild variant="outline" size="sm">
        <Link to={to}>Open</Link>
      </Button>
    </div>
  );
}
