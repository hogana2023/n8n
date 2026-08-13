import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { matchRecipesForUser, shoppingSuggestions } from "@/lib/recipes";
import { RecipeCard } from "@/components/app/recipe-card";
import type { PlanId } from "@/lib/plans";

export const metadata: Metadata = { title: "Tonight" };
export const dynamic = "force-dynamic";

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

export default async function TonightPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const plan = session!.user.plan as PlanId;

  const [matches, expiring, pantryCount] = await Promise.all([
    matchRecipesForUser(userId, plan, { limit: 6 }),
    prisma.pantryItem.findMany({
      where: { userId, expiresAt: { not: null } },
      orderBy: { expiresAt: "asc" },
      take: 5,
    }),
    prisma.pantryItem.count({ where: { userId } }),
  ]);

  const cookNow = matches.filter((m) => m.cookNow);
  const suggestions = shoppingSuggestions(matches);

  return (
    <div className="mx-auto max-w-5xl">
      <header>
        <h1 className="text-h3 font-semibold tracking-tight text-ink">
          {cookNow.length > 0
            ? `${cookNow.length} meal${cookNow.length === 1 ? "" : "s"} you can cook right now`
            : "Let's find you dinner"}
        </h1>
        <p className="mt-2 text-regular text-ink-soft">
          {pantryCount === 0
            ? "Add a few things to your pantry and suggestions appear here."
            : `Matched against ${pantryCount} ingredient${pantryCount === 1 ? "" : "s"} in your kitchen.`}
        </p>
      </header>

      {pantryCount === 0 && (
        <div className="mt-10 rounded-card bg-white p-10 text-center shadow-card">
          <h2 className="text-h5 font-semibold tracking-tight text-ink">
            Your pantry is empty
          </h2>
          <p className="mx-auto mt-3 max-w-md text-regular text-pretty text-ink-soft">
            Start with the ten things you actually cook with. You can add the
            rest whenever you unpack a shop.
          </p>
          <Link href="/app/pantry" className="btn-primary mt-8">
            Add ingredients
          </Link>
        </div>
      )}

      {/* Use-me-first rail */}
      {expiring.length > 0 && (
        <section className="mt-10">
          <h2 className="text-h6 font-semibold tracking-tight text-ink">Use these first</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {expiring.map((item) => {
              const days = daysUntil(item.expiresAt!);
              const urgent = days <= 2;
              return (
                <li
                  key={item.id}
                  className={
                    urgent
                      ? "rounded-full bg-[#fdeceb] px-4 py-2 text-small text-[#b3261e]"
                      : "rounded-full bg-white px-4 py-2 text-small text-ink-soft shadow-sm"
                  }
                >
                  {item.name}
                  <span className="ml-2 tabular-nums opacity-70">
                    {days < 0 ? "past date" : days === 0 ? "today" : `${days}d`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {matches.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="text-h6 font-semibold tracking-tight text-ink">
              Best matches
            </h2>
            <Link
              href="/app/recipes"
              className="text-small font-medium text-accent hover:underline"
            >
              See all ›
            </Link>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((match) => (
              <RecipeCard key={match.recipe.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {suggestions.length > 0 && (
        <section className="mt-12 rounded-card bg-white p-8 shadow-card">
          <h2 className="text-h6 font-semibold tracking-tight text-ink">
            Buy one thing, unlock more
          </h2>
          <p className="mt-2 text-small text-ink-soft">
            Each of these completes at least one recipe you're close to.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <li
                key={item.slug}
                className="rounded-full bg-herb-soft px-4 py-2 text-small text-herb"
              >
                {item.label}
                <span className="ml-2 tabular-nums opacity-70">
                  +{item.unlocks}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
