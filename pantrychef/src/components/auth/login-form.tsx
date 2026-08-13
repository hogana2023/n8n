"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      // next-auth returns a generic CredentialsSignin for both wrong password
      // and unknown account, and we keep it that way on purpose.
      setError("That email and password don't match an account.");
      setPending(false);
      return;
    }

    router.push(result?.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-h3 font-semibold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-3 text-regular text-ink-soft">
        Your pantry is where you left it.
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
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="block text-small font-medium text-ink">
              Password
            </label>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field mt-2"
            placeholder="••••••••"
          />
        </div>

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-8 text-center text-small text-ink-soft">
        New here?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
