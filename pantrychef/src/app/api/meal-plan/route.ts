import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planOf, type PlanId } from "@/lib/plans";
import { AiError, aiConfigured, generateMealPlan } from "@/lib/ai";

export const maxDuration = 300;

const schema = z.object({ days: z.number().int().min(3).max(14).default(7) });

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }

  const plan = session.user.plan as PlanId;
  if (!planOf(plan).mealPlans) {
    return NextResponse.json(
      { error: "Meal plans are part of Plus.", code: "UPGRADE" },
      { status: 402 },
    );
  }

  if (!aiConfigured()) {
    return NextResponse.json({ error: "Not configured on this deployment." }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick between 3 and 14 days." }, { status: 400 });
  }

  const [user, pantry] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { cuisines: true, dietary: true, dislikes: true, appliances: true },
    }),
    prisma.pantryItem.findMany({ where: { userId: session.user.id }, select: { name: true } }),
  ]);

  let generated;
  try {
    generated = await generateMealPlan(
      {
        pantry: pantry.map((item) => item.name),
        cuisines: user?.cuisines ?? [],
        dietary: user?.dietary ?? [],
        dislikes: user?.dislikes ?? [],
        appliances: user?.appliances ?? [],
      },
      parsed.data.days,
    );
  } catch (error) {
    if (error instanceof AiError) {
      const status = error.code === "NOT_CONFIGURED" ? 503 : error.code === "REFUSED" ? 422 : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }

  const saved = await prisma.mealPlan.create({
    data: {
      userId: session.user.id,
      title: generated.title,
      days: parsed.data.days,
      plan: generated.days,
      shopping: generated.shopping,
    },
  });

  return NextResponse.json({ mealPlan: saved }, { status: 201 });
}
