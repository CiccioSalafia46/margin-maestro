import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Carrot,
  ChefHat,
  LineChart,
  Microscope,
  Zap,
  TrendingUp,
  ScrollText,
  Bell,
  Settings as SettingsIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
};

const overviewItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Alerts", url: "/alerts", icon: Bell },
];

const operationsItems: NavItem[] = [
  { title: "Ingredients", url: "/ingredients", icon: Carrot },
  { title: "Recipes", url: "/recipes", icon: ChefHat },
];

const intelligenceItems: NavItem[] = [
  { title: "Menu Analytics", url: "/menu-analytics", icon: LineChart },
  { title: "Dish Analysis", url: "/dish-analysis", icon: Microscope },
  { title: "Impact Cascade", url: "/impact-cascade", icon: Zap },
  { title: "Price Trend", url: "/price-trend", icon: TrendingUp },
  { title: "Price Log", url: "/price-log", icon: ScrollText },
];

const adminItems: NavItem[] = [{ title: "Settings", url: "/settings", icon: SettingsIcon }];

function NavGroup({
  label,
  items,
  currentPath,
  collapsed,
}: {
  label: string;
  items: NavItem[];
  currentPath: string;
  collapsed: boolean;
}) {
  return (
    <SidebarGroup>
      {!collapsed && (
        <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active =
              currentPath === item.url || currentPath.startsWith(item.url + "/");
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                  <Link
                    to={item.url}
                    className={cn(
                      "flex items-center gap-2.5",
                      active && "font-medium",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 px-2 py-1.5"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-xs font-bold">M</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">Margin IQ</p>
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                Intelligence
              </p>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Overview" items={overviewItems} currentPath={currentPath} collapsed={collapsed} />
        <NavGroup label="Operations" items={operationsItems} currentPath={currentPath} collapsed={collapsed} />
        <NavGroup
          label="Intelligence"
          items={intelligenceItems}
          currentPath={currentPath}
          collapsed={collapsed}
        />
        <NavGroup label="Admin" items={adminItems} currentPath={currentPath} collapsed={collapsed} />
      </SidebarContent>
      <SidebarFooter className="border-t">
        {!collapsed && (
          <p className="px-2 py-1 text-[10px] text-muted-foreground">
            Build 1.2A — Ingredients Accepted
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
