import Link from "next/link";

import { Logo } from "@/components/site/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 md:px-12">
        <Link href="/" aria-label="PantryChef home" className="inline-block">
          <Logo className="h-6 w-auto" />
        </Link>
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      {/* Quiet brand panel. Hidden on mobile so the form owns the screen. */}
      <aside className="relative hidden overflow-hidden bg-ink lg:block">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-herb/25 via-transparent to-accent/20"
        />
        <div className="relative flex h-full flex-col justify-end p-14">
          <blockquote className="max-w-md text-h4 font-semibold leading-tight tracking-tight text-white">
            “I haven't thrown out a bag of spinach since March.”
          </blockquote>
          <p className="mt-6 text-regular text-white/60">
            Tom Okafor · cooks for one, Bristol
          </p>
        </div>
      </aside>
    </div>
  );
}
