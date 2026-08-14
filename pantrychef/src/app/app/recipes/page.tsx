import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import type { RecipeKind } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RecipeCard } from "@/components/app/recipe-card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Recipes" };
export const dynamic = "force-dynamic";

const FILTERS: Array<{ id: string; label: string; kind?: RecipeKind; saved?: boolean }> = [
  { id: "all", label: "Everything" },
  { id: "saved", label: "Saved", saved: true },
  { id: "pantry", label: "Pantry", kind: "PANTRY" },
  { id: "leftovers", label: "Leftovers", kind: "LEFTOVERS" },
  { id: "appliance", label: "Appliance", kind: "APPLIANCE" },
  { id: "pet", label: "PantryPup", kind: "PET" },
];

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const session = await getServerSession(authOptions);
  const active = FILTERS.find((f) => f.id === searchParams.filter) ?? FILTERS[0];

  const recipes = await prisma.recipe.findMany({
    where: {
      userId: session!.user.id,
      ...(active.kind ? { kind: active.kind } : {}),
      ...(active.saved ? { saved: true } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-h3 font-semibold tracking-tight text-ink">Your recipes</h1>
        <p className="mt-2 text-regular text-ink-soft">
          Everything PantryChef has written for you.
        </p>
      </header>

      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Filter recipes">
        {FILTERS.map((filter) => (
          <Link
            key={filter.id}
            href={filter.id === "all" ? "/app/recipes" : `/app/recipes?filter=${filter.id}`}
            className={cn(
              "rounded-full px-4 py-2 text-small transition-colors duration-200",
              active.id === filter.id
                ? "bg-ink text-white"
                : "bg-white text-ink-soft shadow-sm hover:text-ink",
            )}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {recipes.length === 0 ? (
        <div className="rounded-card bg-white p-10 text-center shadow-card">
          <h2 className="text-h5 font-semibold tracking-tight text-ink">Nothing here yet</h2>
          <p className="mx-auto mt-3 max-w-md text-regular text-pretty text-ink-soft">
            Generate something and it'll show up here automatically.
          </p>
          <Link href="/app" className="btn-primary mt-8">
            Go to the kitchen
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={{
                id: recipe.id,
                kind: recipe.kind,
                title: recipe.title,
                summary: recipe.summary,
                minutes: recipe.minutes,
                servings: recipe.servings,
                difficulty: recipe.difficulty,
                cuisine: recipe.cuisine,
                appliance: recipe.appliance,
                dietary: recipe.dietary,
                saved: recipe.saved,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
