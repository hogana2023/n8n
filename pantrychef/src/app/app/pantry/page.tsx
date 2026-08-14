import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pantryLimitFor, planOf, type PlanId } from "@/lib/plans";
import { PantryManager } from "@/components/app/pantry-manager";
import { PhotoScan } from "@/components/app/photo-scan";
import { aiConfigured } from "@/lib/ai";

export const metadata: Metadata = { title: "Pantry" };
export const dynamic = "force-dynamic";

export default async function PantryPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const plan = session!.user.plan as PlanId;

  const items = await prisma.pantryItem.findMany({
    where: { userId },
    orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <h1 className="text-h3 font-semibold tracking-tight text-ink">Your pantry</h1>
        <p className="mt-2 text-regular text-ink-soft">
          What every recipe gets built around. Add a use-by date and it moves to
          the front of the queue.
        </p>
      </header>

      <div className="mb-8">
        <PhotoScan enabled={planOf(plan).photoScan && aiConfigured()} />
      </div>

      <PantryManager
        limit={pantryLimitFor(plan)}
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
