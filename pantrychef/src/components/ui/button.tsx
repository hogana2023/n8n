import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Restyled from the Relume defaults: Apple uses filled pills with no border and
// a subtle press-scale, never the bordered dark rectangles Relume ships with.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-button whitespace-nowrap font-medium transition-all duration-200 ease-apple focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/35 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-accent text-white hover:bg-accent-hover",
        primary: "bg-accent text-white hover:bg-accent-hover",
        dark: "bg-ink text-white hover:bg-ink/90",
        alternate: "bg-white text-ink hover:bg-white/90",
        secondary: "bg-surface-neutral text-ink hover:bg-hairline",
        "secondary-alt": "border border-white/40 text-white hover:bg-white/10",
        outline: "border border-hairline bg-transparent text-ink hover:border-ink/40",
        link: "gap-1 rounded-none p-0 text-accent hover:underline underline-offset-4 active:scale-100",
        "link-alt": "gap-1 rounded-none p-0 text-white hover:underline underline-offset-4 active:scale-100",
        ghost: "text-ink hover:bg-surface-muted",
        none: "",
      },
      size: {
        default: "px-6 py-3 text-regular",
        sm: "px-5 py-2 text-small",
        lg: "px-8 py-4 text-medium",
        link: "p-0",
        icon: "size-10",
        none: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    iconLeft?: React.ReactNode;
    iconRight?: React.ReactNode;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  iconLeft,
  iconRight,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {iconLeft && iconLeft}
      <Slottable>{children}</Slottable>
      {iconRight && iconRight}
    </Comp>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
