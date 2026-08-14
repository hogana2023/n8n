import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import type { RecipeKind } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planOf, type PlanId } from "@/lib/plans";
import { checkQuota, recordGeneration } from "@/lib/quota";
import {
  AiError,
  aiConfigured,
  generateForAppliance,
  generateFromLeftovers,
  generateFromPantry,
  generatePetRecipe,
  type GeneratedRecipe,
} from "@/lib/ai";

export const maxDuration = 300;

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("PANTRY"), servings: z.number().int().min(1).max(12).optional() }),
  z.object({
    kind: z.literal("LEFTOVERS"),
    leftovers: z.string().trim().min(2).max(500),
    servings: z.number().int().min(1).max(12).optional(),
  }),
  z.object({
    kind: z.literal("APPLIANCE"),
    appliance: z.enum(["air-fryer", "instant-pot", "slow-cooker", "oven", "hob", "microwave"]),
    servings: z.number().int().min(1).max(12).optional(),
  }),
  z.object({
    kind: z.literal("PET"),
    species: z.enum(["dog", "cat"]),
    weightKg: z.number().min(0.5).max(100),
    notes: z.string().trim().max(300).optional(),
  }),
]);

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }

  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "Recipe generation isn't configured on this deployment." },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the request." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const userId = session.user.id;
  const plan = session.user.plan as PlanId;
  const definition = planOf(plan);

  if (input.kind === "PET" && !definition.petFood) {
    return NextResponse.json(
      { error: "PantryPup is part of Plus.", code: "UPGRADE" },
      { status: 402 },
    );
  }

  const quota = await checkQuota(userId, plan);
  if (quota.exhausted) {
    return NextResponse.json(
      {
        error: `You've used today's ${quota.limit} generations. They reset at midnight UTC, or upgrade for unlimited.`,
        code: "QUOTA",
      },
      { status: 402 },
    );
  }

  const [user, pantry] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { cuisines: true, dietary: true, dislikes: true, appliances: true },
    }),
    prisma.pantryItem.findMany({ where: { userId }, select: { name: true } }),
  ]);

  const pantryNames = pantry.map((item) => item.name);
  const ctx = {
    pantry: pantryNames,
    cuisines: user?.cuisines ?? [],
    dietary: user?.dietary ?? [],
    dislikes: user?.dislikes ?? [],
    appliances: user?.appliances ?? [],
    servings: "servings" in input ? input.servings : undefined,
  };

  let generated: GeneratedRecipe[];
  try {
    switch (input.kind) {
      case "PANTRY":
        generated = await generateFromPantry(ctx);
        break;
      case "LEFTOVERS":
        generated = await generateFromLeftovers(ctx, input.leftovers);
        break;
      case "APPLIANCE":
        generated = await generateForAppliance(ctx, input.appliance);
        break;
      case "PET":
        generated = await generatePetRecipe({
          species: input.species,
          weightKg: input.weightKg,
          notes: input.notes,
          pantry: pantryNames,
        });
        break;
    }
  } catch (error) {
    if (error instanceof AiError) {
      const status = error.code === "NOT_CONFIGURED" ? 503 : error.code === "REFUSED" ? 422 : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }

  const saved = await prisma.$transaction(
    generated.map((recipe) =>
      prisma.recipe.create({
        data: {
          userId,
          kind: input.kind as RecipeKind,
          title: recipe.title,
          summary: recipe.summary,
          minutes: recipe.minutes,
          servings: recipe.servings,
          difficulty: recipe.difficulty,
          cuisine: recipe.cuisine,
          appliance: recipe.appliance,
          dietary: recipe.dietary,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          tips: recipe.tips,
          nutrition: recipe.nutrition,
        },
      }),
    ),
  );

  await recordGeneration(userId, input.kind);
  const after = await checkQuota(userId, plan);

  return NextResponse.json({ recipes: saved, quota: after }, { status: 201 });
}
