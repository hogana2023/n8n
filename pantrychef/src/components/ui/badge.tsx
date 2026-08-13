import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-badge px-2 py-[0.175rem] text-sm leading-[1.5] font-semibold focus:outline-none",
  {
    variants: {
      variant: {
        default: "border border-neutral-lightest bg-neutral-lightest text-neutral-darkest",
        alternate: "border border-white bg-white text-neutral-darkest",
        outline: "border border-white bg-white text-neutral-darkest",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
