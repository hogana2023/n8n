"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useSession } from "next-auth/react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/site/logo";

const NAV_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Journal" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A route change with the sheet still open would leave it covering the new page.
  useEffect(() => setOpen(false), [pathname]);

  // The mobile sheet is full-height; letting the page scroll behind it is the
  // classic iOS scroll-bleed bug.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-shadow duration-300 ease-apple nav-blur",
        scrolled && "shadow-nav",
      )}
    >
      <nav className="shell flex h-[var(--nav-height)] items-center justify-between gap-6">
        <Link href="/" aria-label="PantryChef home" className="shrink-0">
          <Logo className="h-6 w-auto" />
        </Link>

        <ul className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-small text-ink-soft transition-colors duration-200 hover:text-ink"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 lg:flex">
          {status === "loading" ? (
            <div className="h-9 w-40 animate-pulse rounded-full bg-surface-muted" />
          ) : session ? (
            <Link href="/app" className="btn-primary py-2 text-small">
              Open kitchen
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="btn-pill px-4 py-2 text-small text-ink-soft hover:text-ink"
              >
                Log in
              </Link>
              <Link href="/signup" className="btn-primary py-2 text-small">
                Get started
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="-mr-2 flex size-11 flex-col items-center justify-center lg:hidden"
        >
          <motion.span
            className="my-[3px] h-px w-6 bg-ink"
            animate={open ? { rotate: 45, y: 4 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.3, ease: [0.28, 0.11, 0.32, 1] }}
          />
          <motion.span
            className="my-[3px] h-px w-6 bg-ink"
            animate={open ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.3, ease: [0.28, 0.11, 0.32, 1] }}
          />
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.28, 0.11, 0.32, 1] }}
            className="fixed inset-x-0 top-[var(--nav-height)] bottom-0 z-40 overflow-y-auto bg-white/95 backdrop-blur-xl lg:hidden"
          >
            <ul className="shell flex flex-col py-4">
              {NAV_LINKS.map((link, i) => (
                <motion.li
                  key={link.href}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.3 }}
                  className="border-b border-hairline/60"
                >
                  <Link
                    href={link.href}
                    className="block py-5 text-h5 font-semibold tracking-tight text-ink"
                  >
                    {link.label}
                  </Link>
                </motion.li>
              ))}
            </ul>

            <div className="shell mt-4 flex flex-col gap-3 pb-10">
              {session ? (
                <Link href="/app" className="btn-primary w-full">
                  Open kitchen
                </Link>
              ) : (
                <>
                  <Link href="/signup" className="btn-primary w-full">
                    Get started free
                  </Link>
                  <Link href="/login" className="btn-secondary w-full">
                    Log in
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
