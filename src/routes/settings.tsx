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
            <TeamPlaceholder />
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

// ----------------- Team placeholder -----------------
function TeamPlaceholder() {
  const { memberships, activeMembership } = useAuth();
  const list = useMemo(
    () =>
      activeMembership
        ? memberships.filter((m) => m.restaurant.id === activeMembership.restaurant.id)
        : [],
    [memberships, activeMembership],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Team</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Member invitations and role management arrive in a later build. Read-only for now.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Restaurant</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((m) => (
              <TableRow key={m.restaurant.id}>
                <TableCell className="font-medium">{m.restaurant.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="uppercase">
                    {m.role}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
