import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pantryLimitFor } from "@/lib/plans";
import { categoryFor, toSlug } from "@/lib/ingredients";

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const items = await prisma.pantryItem.findMany({
    where: { userId: user.id },
    orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });

  return NextResponse.json({ items, limit: pantryLimitFor(user.plan) });
}

const addSchema = z.object({
  name: z.string().trim().min(1, "Type an ingredient.").max(80),
  quantity: z.string().trim().max(40).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsed = addSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check that entry." },
      { status: 400 },
    );
  }

  const { name, quantity, expiresAt } = parsed.data;
  const slug = toSlug(name);
  if (!slug) {
    return NextResponse.json(
      { error: "We couldn't read an ingredient out of that." },
      { status: 400 },
    );
  }

  const limit = pantryLimitFor(user.plan);
  if (limit !== null) {
    const count = await prisma.pantryItem.count({ where: { userId: user.id } });
    // An existing slug is an update, not an addition, so it never trips the cap.
    const existing = await prisma.pantryItem.findUnique({
      where: { userId_slug: { userId: user.id, slug } },
      select: { id: true },
    });
    if (!existing && count >= limit) {
      return NextResponse.json(
        {
          error: `The free plan tracks ${limit} items. Remove one, or upgrade for unlimited.`,
          code: "PANTRY_LIMIT",
        },
        { status: 402 },
      );
    }
  }

  const item = await prisma.pantryItem.upsert({
    where: { userId_slug: { userId: user.id, slug } },
    create: {
      userId: user.id,
      name: name.trim(),
      slug,
      category: categoryFor(slug),
      quantity: quantity || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    update: {
      name: name.trim(),
      quantity: quantity || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  // Scope the delete to the owner so an id from another account is a no-op.
  const result = await prisma.pantryItem.deleteMany({
    where: { id, userId: user.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
