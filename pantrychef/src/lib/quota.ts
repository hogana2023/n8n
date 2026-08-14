import { prisma } from "@/lib/prisma";
import { planOf, type PlanId } from "@/lib/plans";

/**
 * Daily generation allowance. Counted per user per kind per UTC day, so the
 * window resets on its own with no scheduled job to reset anything.
 */

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export type QuotaState = {
  used: number;
  limit: number | null;
  remaining: number | null;
  exhausted: boolean;
};

export async function checkQuota(userId: string, plan: PlanId): Promise<QuotaState> {
  const limit = planOf(plan).dailyGenerations;
  if (limit === null) {
    return { used: 0, limit: null, remaining: null, exhausted: false };
  }

  const rows = await prisma.generationLog.findMany({
    where: { userId, day: today() },
    select: { count: true },
  });
  const used = rows.reduce((total, row) => total + row.count, 0);

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    exhausted: used >= limit,
  };
}

/** Record one generation. Call after a successful generation, not before. */
export async function recordGeneration(userId: string, kind: string): Promise<void> {
  const day = today();
  await prisma.generationLog.upsert({
    where: { userId_kind_day: { userId, kind, day } },
    create: { userId, kind, day, count: 1 },
    update: { count: { increment: 1 } },
  });
}
