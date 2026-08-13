"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Plan } from "@prisma/client";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/site/logo";
import { PLANS } from "@/lib/plans";

const NAV = [
  { href: "/app", label: "Tonight", exact: true },
  { href: "/app/pantry", label: "Pantry" },
  { href: "/app/recipes", label: "Recipes" },
  { href: "/app/billing", label: "Billing" },
];

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; plan: Plan };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          className={cn(
            "rounded-xl px-4 py-2.5 text-small font-medium transition-colors duration-200",
            isActive(item.href, item.exact)
              ? "bg-white text-ink shadow-sm"
              : "text-ink-soft hover:bg-white/60 hover:text-ink",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-surface-muted">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-hairline bg-white/80 px-5 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/app" aria-label="PantryChef">
          <Logo className="h-5 w-auto" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="rounded-full px-4 py-1.5 text-small font-medium text-ink-soft hover:bg-surface-muted"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && <div className="border-b border-hairline bg-white px-5 py-4 lg:hidden">{nav}</div>}

      <div className="lg:grid lg:grid-cols-[16rem_1fr]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen flex-col border-r border-hairline bg-surface-muted px-5 py-6 lg:flex">
          <Link href="/" aria-label="PantryChef home" className="px-2">
            <Logo className="h-6 w-auto" />
          </Link>

          <div className="mt-8 flex-1">{nav}</div>

          <div className="rounded-card bg-white p-4 shadow-card">
            <p className="text-tiny font-medium uppercase tracking-wide text-ink-faint">
              {PLANS[user.plan].name} plan
            </p>
            <p className="mt-1 truncate text-small font-medium text-ink">{user.name}</p>
            <p className="truncate text-tiny text-ink-faint">{user.email}</p>

            {user.plan === "FREE" && (
              <Link
                href="/app/billing"
                className="mt-3 block rounded-full bg-accent px-3 py-2 text-center text-tiny font-medium text-white hover:bg-accent-hover"
              >
                Upgrade
              </Link>
            )}

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="mt-2 w-full rounded-full px-3 py-2 text-tiny text-ink-soft hover:bg-surface-muted"
            >
              Log out
            </button>
          </div>
        </aside>

        <main className="min-w-0 px-5 py-8 md:px-10 md:py-12">{children}</main>
      </div>
    </div>
  );
}
