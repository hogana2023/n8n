import Link from "next/link";

import { HeroDemo } from "@/components/site/hero-demo";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 md:pt-24 lg:pt-28">
      {/* A single soft wash of colour behind the fold. Apple never uses a
          hard-edged coloured band. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-gradient-to-b from-herb-soft via-white to-white"
      />

      <div className="shell relative">
        <div className="mx-auto max-w-4xl text-center">
          <p className="animate-fade-up text-medium font-medium text-herb">
            Your kitchen, already stocked
          </p>

          <h1 className="mt-4 animate-fade-up text-[2.75rem] font-semibold leading-[1.06] tracking-[-0.025em] text-ink md:text-h1 lg:text-display">
            Dinner is already
            <br className="hidden sm:block" /> in your kitchen.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-large text-pretty text-ink-soft md:text-[1.4rem]">
            Tell PantryChef what you have. It finds the meals you can cook right
            now, tonight, without going to the shop.
          </p>

          <div className="mt-10 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn-primary w-full sm:w-auto">
              Start free
            </Link>
            <Link
              href="/#how"
              className="btn-ghost w-full sm:w-auto"
            >
              See how it works&nbsp;›
            </Link>
          </div>

          <p className="mt-5 text-small text-ink-faint">
            Free forever for 15 ingredients. No card required.
          </p>
        </div>

        <div className="mt-16 md:mt-20">
          <HeroDemo />
        </div>
      </div>
    </section>
  );
}
