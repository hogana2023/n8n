import { Slot } from "@radix-ui/react-slot";
import { ChevronRight, MoreHoriz } from "relume-icons";

import { cn } from "@/lib/utils";

function Breadcrumb({
  ...props
}: React.ComponentProps<"nav"> & {
  separator?: React.ReactNode;
}) {
  return <nav data-slot="breadcrumb" aria-label="breadcrumb" {...props} />;
}

function BreadcrumbList({
  className,
  ...props
}: React.ComponentProps<"ol"> & {
  className?: string;
}) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn("flex flex-wrap items-center gap-2 break-words text-scheme-text", className)}
      {...props}
    />
  );
}

function BreadcrumbItem({
  className,
  ...props
}: React.ComponentProps<"li"> & {
  className?: string;
}) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    />
  );
}

function BreadcrumbLink({
  asChild,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  className?: string;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "a";
  return <Comp data-slot="breadcrumb-link" className={cn(className)} {...props} />;
}

function BreadcrumbPage({
  className,
  ...props
}: React.ComponentProps<"span"> & {
  className?: string;
}) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("text-scheme-text", className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"li"> & {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("text-scheme-text [&>svg]:size-4", className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
}

function BreadcrumbEllipsis({
  className,
  ...props
}: React.ComponentProps<"span"> & {
  className?: string;
}) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHoriz className="size-4" />
      <span className="sr-only">More</span>
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
