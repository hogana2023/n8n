"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Close } from "relume-icons";

import { cn } from "@/lib/utils";

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root> & {
  className?: string;
}) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger> & {
  children?: React.ReactNode;
  asChild?: boolean;
  className?: string;
}) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close> & {
  className?: string;
}) {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className={cn(
        "absolute top-4 right-4 border-none opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      <Close className="size-7 text-white" />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
  );
}

function DialogOverlay({
  className,
  showCloseIcon = true,
  closeIconClassName,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay> & {
  className?: string;
  showCloseIcon?: boolean;
  closeIconClassName?: string;
}) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    >
      {showCloseIcon && <DialogClose className={cn("text-white", closeIconClassName)} />}
    </DialogPrimitive.Overlay>
  );
}

function DialogContent({
  className,
  children,
  closeIconPosition = "outside",
  closeIconClassName,
  overlayClassName,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  overlayClassName?: string;
  closeIconClassName?: string;
  closeIconPosition?: "inside" | "outside";
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay
        className={cn("bg-neutral-darkest/90", overlayClassName)}
        showCloseIcon={closeIconPosition === "outside"}
        closeIconClassName={closeIconClassName}
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 p-6",
          className,
        )}
        {...props}
      >
        {children}
        {closeIconPosition === "inside" && (
          <DialogClose className={cn("text-neutral-darkest", closeIconClassName)} />
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col space-y-1.5 text-base sm:text-left", className)}
      {...props}
    />
  );
}

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center space-x-1 sm:flex-row sm:justify-end",
      className,
    )}
    {...props}
  />
);

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-neutral", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
