import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(0,0,0,0.06)]",
  {
    variants: {
      variant: {
        neutral: "bg-grey-badge text-white",
        low: "bg-black-badge text-white",
        alert: "bg-orange text-white",
        critical: "bg-red-crit text-white",
        success: "bg-green-ok text-white",
        outline: "border border-border-grey text-mid-grey bg-white shadow-none",
        "navy-soft": "bg-navy/10 text-navy shadow-none",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
