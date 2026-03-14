"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { canRoleAccessPath, ROLE_HOME_ROUTE } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/services/api";
import { useNotificationStore } from "@/store/notification-store";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, role, isHydrated } = useAuth();
  const notifyError = useNotificationStore((state) => state.error);
  const [requestedPath, setRequestedPath] = useState<string | null>(null);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("next");
    setRequestedPath(value);
  }, []);

  const [email, setEmail] = useState("alice@example.com");
  const [password, setPassword] = useState("secret123");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && role) {
      if (requestedPath && canRoleAccessPath(role, requestedPath)) {
        router.replace(requestedPath);
        return;
      }
      router.replace(ROLE_HOME_ROUTE[role]);
    }
  }, [isAuthenticated, role, router, requestedPath]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login({ email, password });
    } catch (error) {
      if (error instanceof ApiError) {
        notifyError(error.message, "Login failed");
      } else {
        notifyError("Unable to login. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!isHydrated) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center p-6">
        <section className="panel panel-padding w-full">Preparing session...</section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center p-6">
      <section className="panel panel-padding w-full">
        <h1 className="text-2xl font-semibold text-foreground">Sign in</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Access your role workspace for the A2 E-Corridor demo.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-foreground-muted">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-foreground-muted">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
              required
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
