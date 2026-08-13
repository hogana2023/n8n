import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your PantryChef kitchen.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-surface-muted" />}>
      <LoginForm />
    </Suspense>
  );
}
