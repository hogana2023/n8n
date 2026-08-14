import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PreferencesForm } from "@/components/app/preferences-form";

export const metadata: Metadata = { title: "Preferences" };
export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const session = await getServerSession(authOptions);
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { cuisines: true, dietary: true, dislikes: true, appliances: true },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <h1 className="text-h3 font-semibold tracking-tight text-ink">Preferences</h1>
        <p className="mt-2 text-regular text-ink-soft">
          Set once. Applied to everything PantryChef writes for you, in every mode.
        </p>
      </header>

      <PreferencesForm
        initial={{
          cuisines: user?.cuisines ?? [],
          dietary: user?.dietary ?? [],
          dislikes: user?.dislikes ?? [],
          appliances: user?.appliances ?? [],
        }}
      />
    </div>
  );
}
