import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookbookDiscountFor, formatPence, type PlanId } from "@/lib/plans";
import { stripeConfigured } from "@/lib/stripe";
import { BuyCookbook } from "@/components/app/buy-cookbook";

export const dynamic = "force-dynamic";

type Params = { params: { slug: string }; searchParams: { purchase?: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const book = await prisma.cookbook.findUnique({
    where: { slug: params.slug },
    select: { title: true, description: true },
  });
  return book ? { title: book.title, description: book.description } : { title: "Cookbook" };
}

export default async function CookbookPage({ params, searchParams }: Params) {
  const session = await getServerSession(authOptions);
  const plan = session!.user.plan as PlanId;

  const book = await prisma.cookbook.findUnique({
    where: { slug: params.slug },
    include: {
      entries: {
        orderBy: { position: "asc" },
        include: {
          recipe: { select: { id: true, title: true, minutes: true, summary: true } },
        },
      },
    },
  });
  if (!book?.published) notFound();

  const purchase = await prisma.cookbookPurchase.findUnique({
    where: { userId_cookbookId: { userId: session!.user.id, cookbookId: book.id } },
  });
  const owned = Boolean(purchase);

  const discount = cookbookDiscountFor(plan);
  const price = Math.round(book.pricePence * (1 - discount));

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/app/cookbooks"
        className="text-small text-ink-faint transition-colors hover:text-ink"
      >
        ‹ Cookbooks
      </Link>

      {searchParams.purchase === "success" && (
        <p className="mt-6 rounded-form bg-herb-soft px-4 py-3 text-small text-herb">
          Purchase complete. If it still shows as unowned, give the webhook a
          few seconds and refresh.
        </p>
      )}

      <div className="mt-8 grid gap-10 md:grid-cols-[280px_1fr] md:gap-14">
        <div>
          <div
            className="flex aspect-[3/4] flex-col justify-end rounded-image p-6 shadow-lifted"
            style={{ backgroundColor: book.coverColor }}
          >
            <h1 className="text-h4 font-semibold leading-tight tracking-tight text-white">
              {book.title}
            </h1>
            <p className="mt-2 text-small text-white/70">{book.subtitle}</p>
          </div>

          <div className="mt-6">
            {owned ? (
              <p className="rounded-full bg-herb-soft px-4 py-2.5 text-center text-small font-medium text-herb">
                You own this
              </p>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-h4 font-semibold tabular-nums text-ink">
                    {formatPence(price)}
                  </span>
                  {discount > 0 && (
                    <span className="text-medium text-ink-faint line-through">
                      {formatPence(book.pricePence)}
                    </span>
                  )}
                </div>
                <BuyCookbook slug={book.slug} stripeReady={stripeConfigured()} />
                <p className="mt-3 text-tiny text-ink-faint">
                  One-off purchase. Yours to keep, no subscription.
                </p>
              </>
            )}
          </div>
        </div>

        <div>
          <p className="text-small font-medium text-herb">{book.category}</p>
          <p className="mt-4 text-large text-pretty text-ink-soft">{book.description}</p>

          <h2 className="mt-12 text-h6 font-semibold tracking-tight text-ink">
            {book.entries.length} recipes
          </h2>

          <ul className="mt-5 divide-y divide-hairline overflow-hidden rounded-card bg-white shadow-card">
            {book.entries.map(({ recipe }, index) => (
              <li key={recipe.id}>
                {owned ? (
                  <Link
                    href={`/app/recipes/${recipe.id}`}
                    className="flex gap-4 px-5 py-4 transition-colors hover:bg-surface-muted"
                  >
                    <span className="w-6 shrink-0 text-small tabular-nums text-ink-faint">
                      {index + 1}
                    </span>
                    <span className="flex-1">
                      <span className="block text-regular text-ink">{recipe.title}</span>
                      <span className="mt-0.5 block text-small text-ink-faint">
                        {recipe.minutes} min
                      </span>
                    </span>
                  </Link>
                ) : (
                  <div className="flex gap-4 px-5 py-4">
                    <span className="w-6 shrink-0 text-small tabular-nums text-ink-faint">
                      {index + 1}
                    </span>
                    <span className="flex-1">
                      <span className="block text-regular text-ink">{recipe.title}</span>
                      <span className="mt-0.5 block text-small text-ink-faint">
                        {recipe.minutes} min · method locked
                      </span>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {!owned && book.entries.length > 0 && (
            <p className="mt-4 text-small text-ink-faint">
              Titles and times are shown so you know what you're buying. The
              methods unlock on purchase.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
