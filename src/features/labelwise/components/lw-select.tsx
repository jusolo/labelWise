import { ChevronDown } from "lucide-react"
import type { SelectHTMLAttributes } from "react"

import { cn } from "@/lib/utils"

type LwSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  compact?: boolean
  containerClassName?: string
}

const BASE =
  "w-full rounded-lg border border-input bg-background px-3 pr-8 text-sm text-foreground shadow-xs outline-none appearance-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/35"
const COMPACT = "h-8 rounded-md px-2 pr-7 text-xs"
const REGULAR = "h-9"

export function LwSelect({
  className,
  compact = false,
  containerClassName,
  children,
  ...props
}: LwSelectProps) {
  return (
    <div className={cn("relative", containerClassName)}>
      <select className={cn(BASE, compact ? COMPACT : REGULAR, className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground",
          compact ? "h-3.5 w-3.5" : "h-4 w-4",
        )}
      />
    </div>
  )
}
