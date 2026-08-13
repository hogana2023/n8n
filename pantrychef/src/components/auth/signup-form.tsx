"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();

  // Someone who picked a paid plan on /pricing arrives here with it attached;
  // after signup we send them straight into checkout rather than the dashboard.
  const plan = params.get("plan");
  const interval = params.get("interval") ?? "year";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not create your account.");

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) throw new Error("Account created, but sign-in failed. Try logging in.");

      if (plan === "PLUS" || plan === "FAMILY") {
        const checkout = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, interval }),
        });
        const checkoutData = (await checkout.json()) as { url?: string };
        if (checkout.ok && checkoutData.url) {
          window.location.href = checkoutData.url;
          return;
        }
        // Checkout is best-effort here; a failure shouldn't strand a new account.
      }

      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div>
      <h1 className="text-h3 font-semibold tracking-tight text-ink">
        Start with what you have
      </h1>
      <p className="mt-3 text-regular text-ink-soft">
        Free for 15 ingredients. No card needed.
      </p>

      <form onSubmit={onSubmit} className="mt-10 space-y-4">
        {error && (
          <p
            role="alert"
            className="rounded-form bg-[#fdeceb] px-4 py-3 text-small text-[#b3261e]"
          >
            {error}
          </p>
        )}

        <div>
          <label htmlFor="name" className="block text-small font-medium text-ink">
            Name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field mt-2"
            placeholder="Alex"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-small font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field mt-2"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-small font-medium text-ink">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field mt-2"
            placeholder="At least 8 characters"
          />
        </div>

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Creating your kitchen…" : "Create account"}
        </button>

        <p className="text-tiny text-ink-faint">
          By creating an account you agree to our{" "}
          <Link href="/legal/terms" className="text-accent hover:underline">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="text-accent hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </form>

      <p className="mt-8 text-center text-small text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
