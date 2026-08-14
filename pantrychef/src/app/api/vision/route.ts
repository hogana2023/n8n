import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planOf, pantryLimitFor, type PlanId } from "@/lib/plans";
import { AiError, aiConfigured, detectIngredients, isSupportedImage } from "@/lib/ai";
import { categoryFor, toSlug } from "@/lib/ingredients";

export const maxDuration = 300;

/** Anything larger is a phone photo that hasn't been downscaled. */
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }

  const plan = session.user.plan as PlanId;
  if (!planOf(plan).photoScan) {
    return NextResponse.json(
      { error: "Photo scanning is part of Plus.", code: "UPGRADE" },
      { status: 402 },
    );
  }

  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "Photo scanning isn't configured on this deployment." },
      { status: 503 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a photo." }, { status: 400 });
  }

  if (!isSupportedImage(file.type)) {
    return NextResponse.json(
      { error: "Use a JPEG, PNG, WebP, or GIF." },
      { status: 415 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That photo is over 8MB. Try a smaller one." },
      { status: 413 },
    );
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  let detected;
  try {
    detected = await detectIngredients(base64, file.type);
  } catch (error) {
    if (error instanceof AiError) {
      const status = error.code === "NOT_CONFIGURED" ? 503 : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }

  // Low-confidence guesses are returned for the user to confirm, never added
  // silently — a wrong ingredient quietly poisons every later suggestion.
  const confident = detected.filter((item) => item.confidence !== "low");
  const uncertain = detected.filter((item) => item.confidence === "low");

  const limit = pantryLimitFor(plan);
  const existingCount = await prisma.pantryItem.count({ where: { userId: session.user.id } });
  const room = limit === null ? confident.length : Math.max(0, limit - existingCount);

  const added = [];
  for (const item of confident.slice(0, room)) {
    const slug = toSlug(item.name);
    if (!slug) continue;
    added.push(
      await prisma.pantryItem.upsert({
        where: { userId_slug: { userId: session.user.id, slug } },
        create: {
          userId: session.user.id,
          name: item.name,
          slug,
          category: categoryFor(slug),
          fromPhoto: true,
        },
        update: { name: item.name, fromPhoto: true },
      }),
    );
  }

  return NextResponse.json({
    added,
    uncertain,
    skipped: Math.max(0, confident.length - room),
  });
}
