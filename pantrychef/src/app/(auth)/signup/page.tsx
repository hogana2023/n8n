import type { Metadata } from "next";
import { Suspense } from "react";

import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Start free. Track 15 ingredients and see what you can cook tonight.",
};

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-surface-muted" />}>
      <SignupForm />
    </Suspense>
  );
}
