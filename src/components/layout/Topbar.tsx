import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { restaurantSettings } from "@/data/mock";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="h-6" />
      <div className="flex min-w-0 items-center gap-2">
        <p className="truncate text-sm font-semibold text-foreground">
          {restaurantSettings.restaurant_name}
        </p>
        <Badge
          variant="outline"
          className="border-warning/40 bg-warning/15 text-[10px] font-medium uppercase tracking-wider text-warning-foreground"
        >
          Demo
        </Badge>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-xs font-medium text-foreground">Operator</p>
          <p className="text-[11px] text-muted-foreground">demo@margin-iq.app</p>
        </div>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
            OP
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
