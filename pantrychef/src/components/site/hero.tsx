import Link from "next/link";

import { HeroDemo } from "@/components/site/hero-demo";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-hairline pt-20 md:pt-28">
      <div className="shell">
        <div className="max-w-3xl">
          <h1 className="text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.028em] text-ink md:text-h1 lg:text-display">
            You have the ingredients.
            <br />
            You're missing the recipe.
          </h1>

          <p className="mt-7 max-w-xl text-large text-pretty text-ink-soft md:text-[1.35rem]">
            PantryChef writes it. From what's in your kitchen, in the cuisines
            you like, inside the allergies you can't cross. Photograph the
            fridge if typing is too much effort.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="btn-primary w-full sm:w-auto">
              Start free
            </Link>
            <Link href="/#features" className="btn-secondary w-full sm:w-auto">
              What it does
            </Link>
          </div>

          <p className="mt-5 text-small text-ink-faint">
            Three recipes a day on the free plan. No card.
          </p>
        </div>
      </div>

      <div className="shell mt-20 md:mt-24">
        <HeroDemo />
      </div>
    </section>
  );
}
