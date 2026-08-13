import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  // Middleware already guards this, but a server-side check means a page can
  // never render against a missing session if the matcher ever changes.
  if (!session?.user) redirect("/login?callbackUrl=/app");

  return (
    <AppShell
      user={{
        name: session.user.name ?? "Cook",
        email: session.user.email ?? "",
        plan: session.user.plan,
      }}
    >
      {children}
    </AppShell>
  );
}
