import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Till buttons: ink for the main action, paper with a line for the rest. Violet (the signing
// stamp) is added with className="btn-sign" where a button signs.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-[12px] border border-transparent bg-clip-padding font-semibold leading-none whitespace-nowrap transition-[background,border-color,opacity] outline-none select-none disabled:pointer-events-none disabled:opacity-60 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-[var(--ink)] text-white hover:bg-[#2c3247]",
        outline: "border-[var(--line-2)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--ink-2)] aria-expanded:border-[var(--ink-2)]",
        secondary: "border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] hover:border-[var(--line-2)]",
        ghost: "text-[var(--ink)] hover:bg-[var(--panel)]",
        destructive: "bg-[#fbe9e7] text-[var(--bad)] hover:bg-[#f7dcd8]",
        link: "text-[var(--ink)] underline decoration-[var(--line-2)] underline-offset-4 hover:decoration-[var(--ink)]",
      },
      size: {
        default: "h-10 px-4 text-[15px]",
        xs: "h-7 gap-1 rounded-[8px] px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-[10px] px-3.5 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 px-[18px] text-[15px]",
        icon: "size-9 rounded-[10px]",
        "icon-xs": "size-6 rounded-[8px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-[10px]",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
