// Dashboard API — Build 1.9.
// Derives dashboard data from existing Supabase-backed modules. No new tables.

import { getAlerts, deriveAlertSummary } from "./alertsApi";
import { getImpactCascadeRuns, getImpactCascadeItems } from "./impactCascadeApi";
import { getMenuAnalyticsData } from "./menuAnalyticsApi";
import { getPriceLogEntries, getPriceUpdateBatches, getSnapshotStatus } from "./priceLogApi";
import type {
  AlertRow,
  AlertSummary,
  ImpactCascadeItemRow,
  ImpactCascadeRunRow,
  MenuAnalyticsRow,
  MenuAnalyticsSummary,
  PriceUpdateBatchRow,
  IngredientPriceLogRow,
  SnapshotStatus,
} from "./types";

export interface DashboardData {
  // Alerts
  alertSummary: AlertSummary;
  latestAlerts: AlertRow[];
  criticalAlerts: AlertRow[];

  // Menu profitability
  menuSummary: MenuAnalyticsSummary;
  menuRows: MenuAnalyticsRow[];
  worstDishes: MenuAnalyticsRow[];
  missingPriceDishes: MenuAnalyticsRow[];

  // Impact cascade
  latestRun: ImpactCascadeRunRow | null;
  latestImpactItems: ImpactCascadeItemRow[];

  // Price activity
  latestBatch: PriceUpdateBatchRow | null;
  recentLogEntries: IngredientPriceLogRow[];
  recentChangeCount: number;

  // Snapshot
  snapshotStatus: SnapshotStatus;

  // Recommended actions
  recommendedActions: string[];
}

export async function getDashboardData(restaurantId: string): Promise<DashboardData> {
  const [alerts, menuData, runs, batches, logEntries, snapStatus] = await Promise.all([
    getAlerts(restaurantId),
    getMenuAnalyticsData(restaurantId),
    getImpactCascadeRuns(restaurantId),
    getPriceUpdateBatches(restaurantId),
    getPriceLogEntries(restaurantId),
    getSnapshotStatus(restaurantId),
  ]);

  const alertSummary = deriveAlertSummary(alerts);
  const openAlerts = alerts.filter((a) => a.status === "open");
  const criticalAlerts = openAlerts.filter((a) => a.severity === "critical");
  const latestAlerts = openAlerts.slice(0, 5);

  const worstDishes = [...menuData.rows]
    .filter((r) => r.gpm != null && r.menu_price != null && r.menu_price > 0)
    .sort((a, b) => (a.gpm ?? 1) - (b.gpm ?? 1))
    .slice(0, 5);

  const missingPriceDishes = menuData.rows.filter((r) => r.menu_price == null || r.menu_price <= 0);

  const latestRun = runs[0] ?? null;
  let latestImpactItems: ImpactCascadeItemRow[] = [];
  if (latestRun) {
    latestImpactItems = await getImpactCascadeItems(restaurantId, latestRun.id);
  }

  const manualBatches = batches.filter((b) => b.status === "applied" && b.source === "manual");
  const latestBatch = manualBatches[0] ?? null;

  const changeEntries = logEntries.filter((e) => e.event_type === "change");
  const recentLogEntries = logEntries.slice(0, 10);

  // Recommended actions
  const actions: string[] = [];
  if (criticalAlerts.length > 0) actions.push(`Review ${criticalAlerts.length} critical alert(s).`);
  if (menuData.summary.below_target_count > 0) actions.push(`${menuData.summary.below_target_count} dish(es) below target GPM — open Menu Analytics.`);
  if (missingPriceDishes.length > 0) actions.push(`Set menu price for ${missingPriceDishes.length} dish(es).`);
  if (menuData.summary.incomplete_costing_count > 0) actions.push(`Complete costing for ${menuData.summary.incomplete_costing_count} dish(es).`);
  if (latestRun && latestRun.newly_below_target_count > 0) actions.push(`Review Impact Cascade — ${latestRun.newly_below_target_count} dish(es) newly below target.`);
  if (!snapStatus.initialized) actions.push("Initialize baseline from Price Log.");
  if (alerts.length === 0 && menuData.rows.length > 0) actions.push("Generate alerts to surface margin intelligence.");
  if (actions.length === 0) actions.push("No immediate actions. Monitor for supplier price changes.");

  return {
    alertSummary,
    latestAlerts,
    criticalAlerts,
    menuSummary: menuData.summary,
    menuRows: menuData.rows,
    worstDishes,
    missingPriceDishes,
    latestRun,
    latestImpactItems,
    latestBatch,
    recentLogEntries,
    recentChangeCount: changeEntries.length,
    snapshotStatus: snapStatus,
    recommendedActions: actions,
  };
}
