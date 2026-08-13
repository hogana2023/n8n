"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Close } from "relume-icons";

import { cn } from "@/lib/utils";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}
function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger> & {
  className?: string;
  asChild?: boolean;
  children: React.ReactNode;
}) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  children,
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close> & {
  children?: React.ReactNode;
  className?: string;
  asChild?: boolean;
}) {
  return (
    <SheetPrimitive.Close
      className={cn("absolute top-4 right-4 z-40 disabled:pointer-events-none", className)}
      {...props}
    >
      {children || <Close className="size-8 text-scheme-text" />}
    </SheetPrimitive.Close>
  );
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  children,
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay> & {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-30 bg-neutral-darkest/25 data-[state=closed]:animate-out data-[state=closed]:duration-700 data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:duration-700 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    >
      {children}
    </SheetPrimitive.Overlay>
  );
}

function SheetContent({
  children,
  className,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <SheetPrimitive.Content
      data-slot="sheet-content"
      className={cn(
        "fixed z-50 gap-4 overflow-scroll bg-white transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-700 data-[state=open]:animate-in data-[state=open]:duration-700",
        side === "right" &&
          "inset-y-0 right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        side === "left" &&
          "inset-y-0 left-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        side === "top" &&
          "inset-x-0 top-0 left-1/2 -translate-x-1/2 data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        side === "bottom" &&
          "inset-x-0 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 data-[state=closed]:slide-out-to-bottom-[150%] data-[state=open]:slide-in-from-bottom",
        className,
      )}
      {...props}
    >
      {children}
    </SheetPrimitive.Content>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title> & {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-scheme-1-text text-lg font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-scheme-1-text text-sm", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
