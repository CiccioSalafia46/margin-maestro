import { useNavigate } from "@tanstack/react-router";
import { LogOut, Building2 } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/auth/AuthProvider";

export function Topbar() {
  const { activeMembership, memberships, setActiveRestaurantId, email, signOut } = useAuth();
  const navigate = useNavigate();

  const restaurantName = activeMembership?.restaurant.name ?? "Margin IQ";
  const initials = (email ?? "OP").slice(0, 2).toUpperCase();

  const onSignOut = async () => {
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <SidebarTrigger
        aria-label="Toggle sidebar"
        className="text-muted-foreground hover:text-foreground"
      />
      <Separator orientation="vertical" className="h-6" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 px-2 font-semibold"
            aria-label="Switch restaurant"
          >
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{restaurantName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[16rem]">
          <DropdownMenuLabel>Restaurants</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={activeMembership?.restaurant.id ?? ""}
            onValueChange={(v) => setActiveRestaurantId(v)}
          >
            {memberships.map((m) => (
              <DropdownMenuRadioItem key={m.restaurant.id} value={m.restaurant.id}>
                <span className="flex-1 truncate">{m.restaurant.name}</span>
                <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {m.role}
                </span>
              </DropdownMenuRadioItem>
            ))}
            {memberships.length === 0 && (
              <DropdownMenuItem disabled>No restaurants</DropdownMenuItem>
            )}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Add restaurant (coming soon)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Badge
        variant="outline"
        className="border-warning/40 bg-warning/15 text-[10px] font-medium uppercase tracking-wider text-warning-foreground"
      >
        Demo data
      </Badge>

      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent"
              aria-label="Account menu"
            >
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium text-foreground">
                  {activeMembership?.role
                    ? activeMembership.role[0].toUpperCase() + activeMembership.role.slice(1)
                    : "Member"}
                </p>
                <p className="max-w-[180px] truncate text-[11px] text-muted-foreground">
                  {email ?? "—"}
                </p>
              </div>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
