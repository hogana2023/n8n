import Link from "next/link";

import { Logo } from "@/components/site/logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how" },
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Your kitchen", href: "/app" },
    ],
  },
  {
    title: "Read",
    links: [
      { label: "Journal", href: "/blog" },
      { label: "Reducing waste", href: "/blog?category=Waste" },
      { label: "Weeknight cooking", href: "/blog?category=Cooking" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Log in", href: "/login" },
      { label: "Create account", href: "/signup" },
      { label: "Billing", href: "/app/billing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Terms", href: "/legal/terms" },
      { label: "Contact", href: "mailto:hello@pantrychef.app" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-surface-muted">
      <div className="shell py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_3fr]">
          <div>
            <Link href="/" aria-label="PantryChef home">
              <Logo className="h-6 w-auto" />
            </Link>
            <p className="mt-4 max-w-xs text-small text-pretty text-ink-soft">
              Dinner from what you already have. Built for people who would
              rather cook than plan.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <h3 className="text-small font-semibold text-ink">{column.title}</h3>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-small text-ink-soft transition-colors duration-200 hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-hairline pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-tiny text-ink-faint">
            © {new Date().getFullYear()} PantryChef. All rights reserved.
          </p>
          <p className="text-tiny text-ink-faint">
            Prices include VAT where applicable.
          </p>
        </div>
      </div>
    </footer>
  );
}
