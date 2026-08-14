import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkQuota } from "@/lib/quota";
import { planOf, type PlanId } from "@/lib/plans";
import { Generator } from "@/components/app/generator";
import { aiConfigured } from "@/lib/ai";

export const metadata: Metadata = { title: "Kitchen" };
export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const plan = session!.user.plan as PlanId;

  const [pantryCount, quota, expiring, recent] = await Promise.all([
    prisma.pantryItem.count({ where: { userId } }),
    checkQuota(userId, plan),
    prisma.pantryItem.findMany({
      where: { userId, expiresAt: { not: null } },
      orderBy: { expiresAt: "asc" },
      take: 4,
    }),
    prisma.recipe.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, title: true, minutes: true, kind: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-h3 font-semibold tracking-tight text-ink">
          What are we cooking?
        </h1>
        <p className="mt-2 text-regular text-ink-soft">
          {pantryCount === 0
            ? "Add a few ingredients and it'll write you something."
            : `Working from ${pantryCount} ingredient${pantryCount === 1 ? "" : "s"} in your pantry.`}
        </p>
      </header>

      {!aiConfigured() && (
        <p className="mb-6 rounded-form bg-[#fff4e5] px-4 py-3 text-small text-[#8a5a00]">
          <code className="font-mono">ANTHROPIC_API_KEY</code> isn't set on this
          deployment, so generation is disabled. See the README.
        </p>
      )}

      {expiring.length > 0 && (
        <div className="mb-8 rounded-card bg-white p-5 shadow-card">
          <p className="text-small font-medium text-ink">Use these first</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {expiring.map((item) => {
              const days = Math.ceil(
                (item.expiresAt!.getTime() - Date.now()) / 86_400_000,
              );
              return (
                <li
                  key={item.id}
                  className={
                    days <= 2
                      ? "rounded-full bg-[#fdeceb] px-3.5 py-1.5 text-small text-[#b3261e]"
                      : "rounded-full bg-surface-muted px-3.5 py-1.5 text-small text-ink-soft"
                  }
                >
                  {item.name}
                  <span className="ml-2 tabular-nums opacity-70">
                    {days < 0 ? "past" : days === 0 ? "today" : `${days}d`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Generator
        pantryCount={pantryCount}
        quota={{ used: quota.used, limit: quota.limit, remaining: quota.remaining }}
        canPet={planOf(plan).petFood}
      />

      {recent.length > 0 && (
        <section className="mt-14">
          <div className="flex items-baseline justify-between">
            <h2 className="text-h6 font-semibold tracking-tight text-ink">Recently written</h2>
            <Link
              href="/app/recipes"
              className="text-small font-medium text-accent hover:underline"
            >
              All recipes ›
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-hairline overflow-hidden rounded-card bg-white shadow-card">
            {recent.map((recipe) => (
              <li key={recipe.id}>
                <Link
                  href={`/app/recipes/${recipe.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface-muted"
                >
                  <span className="text-regular text-ink">{recipe.title}</span>
                  <span className="shrink-0 text-tiny text-ink-faint">
                    {recipe.minutes} min
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
