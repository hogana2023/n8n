import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookbookDiscountFor, formatPence, type PlanId } from "@/lib/plans";

export const metadata: Metadata = { title: "Cookbooks" };
export const dynamic = "force-dynamic";

export default async function CookbooksPage() {
  const session = await getServerSession(authOptions);
  const plan = session!.user.plan as PlanId;
  const discount = cookbookDiscountFor(plan);

  const [cookbooks, owned] = await Promise.all([
    prisma.cookbook.findMany({
      where: { published: true },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { entries: true } } },
    }),
    prisma.cookbookPurchase.findMany({
      where: { userId: session!.user.id },
      select: { cookbookId: true },
    }),
  ]);

  const ownedIds = new Set(owned.map((purchase) => purchase.cookbookId));

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-h3 font-semibold tracking-tight text-ink">Cookbooks</h1>
        <p className="mt-2 text-regular text-ink-soft">
          Curated collections, bought once and kept. No subscription needed.
          {discount > 0 && (
            <span className="text-herb"> Your plan takes {discount * 100}% off.</span>
          )}
        </p>
      </header>

      {cookbooks.length === 0 ? (
        <div className="rounded-card bg-white p-10 text-center shadow-card">
          <h2 className="text-h5 font-semibold tracking-tight text-ink">
            No cookbooks published yet
          </h2>
          <p className="mx-auto mt-3 max-w-md text-regular text-pretty text-ink-soft">
            Run <code className="font-mono text-small">npm run db:seed</code> to
            load the starter collections, then publish them.
          </p>
        </div>
      ) : (
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {cookbooks.map((book) => {
            const isOwned = ownedIds.has(book.id);
            const price = Math.round(book.pricePence * (1 - discount));

            return (
              <li key={book.id}>
                <Link href={`/app/cookbooks/${book.slug}`} className="group block">
                  <div
                    className="flex aspect-[3/4] flex-col justify-end rounded-image p-6 shadow-card transition-transform duration-300 ease-apple group-hover:-translate-y-1"
                    style={{ backgroundColor: book.coverColor }}
                  >
                    <h2 className="text-h5 font-semibold leading-tight tracking-tight text-white">
                      {book.title}
                    </h2>
                    <p className="mt-2 text-small text-white/70">{book.subtitle}</p>
                  </div>

                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="text-small text-ink-soft">
                      {book._count.entries} recipes
                    </span>
                    <span className="text-small font-semibold text-ink">
                      {isOwned ? (
                        <span className="text-herb">Owned</span>
                      ) : (
                        <>
                          {formatPence(price)}
                          {discount > 0 && (
                            <span className="ml-1.5 font-normal text-ink-faint line-through">
                              {formatPence(book.pricePence)}
                            </span>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
