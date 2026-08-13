import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scoreRecipe } from "@/lib/recipes";
import { isPaid, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { params: { slug: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const recipe = await prisma.recipe.findUnique({
    where: { slug: params.slug },
    select: { title: true, summary: true },
  });
  return recipe ? { title: recipe.title, description: recipe.summary } : { title: "Recipe" };
}

export default async function RecipeDetailPage({ params }: Params) {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const plan = session!.user.plan as PlanId;

  const recipe = await prisma.recipe.findUnique({
    where: { slug: params.slug },
    include: { ingredients: true },
  });
  if (!recipe) notFound();

  // Premium recipes are gated server-side; hiding the link alone would leave
  // the method readable to anyone who guessed the URL.
  if (recipe.isPremium && !isPaid(plan)) {
    redirect("/app/billing?locked=" + encodeURIComponent(recipe.slug));
  }

  const pantry = await prisma.pantryItem.findMany({
    where: { userId },
    select: { slug: true },
  });
  const match = scoreRecipe(recipe, new Set(pantry.map((p) => p.slug)));

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/app/recipes"
        className="text-small text-ink-faint transition-colors hover:text-ink"
      >
        ‹ Recipes
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          {match.cookNow ? (
            <span className="rounded-full bg-herb-soft px-3 py-1 text-tiny font-medium text-herb">
              Everything in stock
            </span>
          ) : (
            <span className="rounded-full bg-surface-neutral px-3 py-1 text-tiny font-medium text-ink-soft">
              {match.score}% match
            </span>
          )}
          <span className="text-tiny text-ink-faint">
            {recipe.minutes} min · serves {recipe.servings} · {recipe.difficulty}
          </span>
        </div>

        <h1 className="mt-4 text-h3 font-semibold tracking-tight text-ink">
          {recipe.title}
        </h1>
        <p className="mt-3 text-large text-pretty text-ink-soft">{recipe.summary}</p>
      </header>

      {recipe.imageUrl && (
        <div
          className="mt-8 aspect-[16/9] w-full rounded-image bg-surface-muted bg-cover bg-center"
          style={{ backgroundImage: `url(${recipe.imageUrl})` }}
        />
      )}

      <div className="mt-12 grid gap-12 md:grid-cols-[1fr_1.4fr]">
        <section>
          <h2 className="text-h6 font-semibold tracking-tight text-ink">Ingredients</h2>
          <ul className="mt-4 space-y-2.5">
            {recipe.ingredients.map((ingredient) => {
              const have =
                ingredient.isStaple || match.have.includes(ingredient.slug);
              return (
                <li key={ingredient.id} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md text-[11px] font-bold text-white",
                      have ? "bg-herb" : "bg-hairline",
                    )}
                  >
                    {have ? "✓" : ""}
                  </span>
                  <span className={cn("text-regular", have ? "text-ink-soft" : "text-ink")}>
                    {ingredient.amount ? `${ingredient.amount} ` : ""}
                    {ingredient.label}
                    {ingredient.isStaple && (
                      <span className="ml-1.5 text-tiny text-ink-faint">(staple)</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>

          {match.missing.length > 0 && (
            <div className="mt-6 rounded-form bg-surface-muted px-4 py-3">
              <p className="text-small text-ink-soft">
                You need {match.missing.map((m) => m.label).join(", ")}.
              </p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-h6 font-semibold tracking-tight text-ink">Method</h2>
          <ol className="mt-4 space-y-6">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-ink text-tiny font-semibold text-white">
                  {i + 1}
                </span>
                <p className="text-regular text-pretty text-ink-soft">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
