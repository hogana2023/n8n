import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pantryLimitFor } from "@/lib/plans";
import { PantryManager } from "@/components/app/pantry-manager";

export const metadata: Metadata = { title: "Pantry" };
export const dynamic = "force-dynamic";

export default async function PantryPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const items = await prisma.pantryItem.findMany({
    where: { userId },
    orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <h1 className="text-h3 font-semibold tracking-tight text-ink">Your pantry</h1>
        <p className="mt-2 text-regular text-ink-soft">
          Everything PantryChef matches against. Add a use-by date and it moves
          to the front of your suggestions.
        </p>
      </header>

      <PantryManager
        limit={pantryLimitFor(session!.user.plan)}
        initialItems={items.map((item) => ({
          id: item.id,
          name: item.name,
          slug: item.slug,
          category: item.category,
          quantity: item.quantity,
          expiresAt: item.expiresAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
