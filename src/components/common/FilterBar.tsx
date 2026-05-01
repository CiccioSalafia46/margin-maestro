import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b bg-muted/30 px-6 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
