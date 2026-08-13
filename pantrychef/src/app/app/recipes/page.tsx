import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { matchRecipesForUser } from "@/lib/recipes";
import { RecipeCard } from "@/components/app/recipe-card";
import { isPaid, type PlanId } from "@/lib/plans";

export const metadata: Metadata = { title: "Recipes" };
export const dynamic = "force-dynamic";

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const session = await getServerSession(authOptions);
  const plan = session!.user.plan as PlanId;
  const onlyCookNow = searchParams.filter === "cook-now";

  const matches = await matchRecipesForUser(session!.user.id, plan, {
    limit: 48,
    onlyCookNow,
  });

  const lockedCount = matches.filter((m) => m.locked).length;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-h3 font-semibold tracking-tight text-ink">Recipes</h1>
        <p className="mt-2 text-regular text-ink-soft">
          Ranked by how much of each one your kitchen already covers.
        </p>
      </header>

      <nav className="mb-8 flex gap-2" aria-label="Filter recipes">
        <Link
          href="/app/recipes"
          className={
            onlyCookNow
              ? "rounded-full bg-white px-4 py-2 text-small text-ink-soft shadow-sm hover:text-ink"
              : "rounded-full bg-ink px-4 py-2 text-small text-white"
          }
        >
          All matches
        </Link>
        <Link
          href="/app/recipes?filter=cook-now"
          className={
            onlyCookNow
              ? "rounded-full bg-ink px-4 py-2 text-small text-white"
              : "rounded-full bg-white px-4 py-2 text-small text-ink-soft shadow-sm hover:text-ink"
          }
        >
          Cook right now
        </Link>
      </nav>

      {matches.length === 0 ? (
        <div className="rounded-card bg-white p-10 text-center shadow-card">
          <h2 className="text-h5 font-semibold tracking-tight text-ink">
            {onlyCookNow ? "Nothing's fully covered yet" : "No matches yet"}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-regular text-pretty text-ink-soft">
            {onlyCookNow
              ? "You're close on a few. Switch to all matches to see what you're missing."
              : "Add a few more ingredients and recipes will start appearing."}
          </p>
          <Link href="/app/pantry" className="btn-primary mt-8">
            Go to pantry
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <RecipeCard key={match.recipe.id} match={match} />
          ))}
        </div>
      )}

      {!isPaid(plan) && lockedCount > 0 && (
        <div className="mt-10 rounded-card bg-ink p-8 text-center">
          <h2 className="text-h5 font-semibold tracking-tight text-white">
            {lockedCount} more {lockedCount === 1 ? "recipe" : "recipes"} match your pantry
          </h2>
          <p className="mx-auto mt-3 max-w-md text-regular text-pretty text-white/70">
            The full chef-developed library comes with Plus.
          </p>
          <Link href="/app/billing" className="btn-pill mt-6 bg-white text-ink hover:bg-white/90">
            See plans
          </Link>
        </div>
      )}
    </div>
  );
}
