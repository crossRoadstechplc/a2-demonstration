"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { canRoleAccessPath, ROLE_HOME_ROUTE } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/services/api";
import { useNotificationStore } from "@/store/notification-store";

const DEMO_ACCOUNTS = [
  { label: "A2 Operator", email: "alicea2@example.com", color: "#0ea5e9" },
  { label: "Station Operator", email: "alicestation@example.com", color: "#22c55e" },
  { label: "Fleet Owner", email: "alicefleet@example.com", color: "#f59e0b" },
  { label: "Freight Customer", email: "alicefrieght@example.com", color: "#a855f7" },
  { label: "EEU Operator", email: "aliceeeu@example.com", color: "#14b8a6" },
  { label: "Driver", email: "alicedriver@example.com", color: "#ef4444" },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, role, isHydrated } = useAuth();
  const notifyError = useNotificationStore((state) => state.error);
  const [requestedPath, setRequestedPath] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("next");
    setRequestedPath(value);
  }, []);

  const [email, setEmail] = useState("alicea2@example.com");
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

  function selectAccount(accountEmail: string) {
    setEmail(accountEmail);
    setPassword("secret123");
    navigator.clipboard.writeText(accountEmail).catch(() => {});
    setCopiedEmail(accountEmail);
    setTimeout(() => setCopiedEmail(null), 1800);
  }

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
      <div className="flex min-h-screen items-center justify-center bg-[#edf2fb]">
        <div className="text-sm text-[#526787]">Preparing session…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#edf2fb] p-8">

      {/* Island card */}
      <div className="flex w-full max-w-[860px] overflow-hidden rounded-2xl bg-white shadow-[0_16px_48px_rgba(44,64,97,0.14)] ring-1 ring-[rgba(69,102,163,0.12)]">

      {/* ── Left: Logo panel ── */}
      <div className="hidden flex-1 flex-col items-center justify-center bg-[#f4f7fd] p-12 lg:flex"
        style={{ borderRight: "1px solid rgba(69,102,163,0.1)" }}>
        <div className="rounded-2xl bg-white p-8 shadow-[0_4px_20px_rgba(44,64,97,0.08)] ring-1 ring-[rgba(69,102,163,0.08)]">
          <Image
            src="/logo.png"
            alt="A2 Access Africa E-Corridor"
            width={200}
            height={200}
            className="h-auto w-auto"
            priority
          />
        </div>
        <p className="mt-6 text-sm font-medium text-[#526787]">
          Ethiopia–Djibouti E-Corridor Platform
        </p>
        <p className="mt-1 text-xs text-[#526787]/50">© 2025 Access Africa A2 · Investor Demo</p>
      </div>

      {/* ── Right: Login form ── */}
      <div className="flex w-full flex-col justify-center px-10 py-10 lg:w-[420px] lg:shrink-0">

        {/* Mobile logo */}
        <div className="mb-8 lg:hidden flex justify-center">
          <Image src="/logo.png" alt="A2" width={90} height={90} className="h-auto w-auto" priority />
        </div>

        <div className="w-full">

          {/* Heading */}
          <h1 className="text-3xl font-bold text-[#10203b]">Sign in</h1>

          {/* Form */}
          <form className="mt-7 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#526787]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[rgba(69,102,163,0.25)] bg-white px-4 py-2.5 text-sm text-[#10203b] outline-none transition placeholder:text-[#526787]/40 focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/15"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#526787]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[rgba(69,102,163,0.25)] bg-white px-4 py-2.5 text-sm text-[#10203b] outline-none transition placeholder:text-[#526787]/40 focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/15"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)",
                boxShadow: "0 2px 14px rgba(14,165,233,0.28)",
              }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-8">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[rgba(69,102,163,0.15)]" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#526787]/60">
                Quick login
              </p>
              <div className="h-px flex-1 bg-[rgba(69,102,163,0.15)]" />
            </div>
            <p className="mt-2 text-center text-xs text-[#526787]/60">
              Click a role to fill credentials &amp; copy email
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => {
                const isActive = email === account.email;
                const wasCopied = copiedEmail === account.email;
                return (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => selectAccount(account.email)}
                    className="group relative rounded-xl border px-3 py-2.5 text-left text-xs transition-all"
                    style={{
                      borderColor: isActive
                        ? account.color
                        : "rgba(69,102,163,0.18)",
                      background: isActive
                        ? `${account.color}12`
                        : "white",
                    }}
                  >
                    {/* Color dot */}
                    <span
                      className="mb-1.5 inline-block h-2 w-2 rounded-full"
                      style={{ background: account.color }}
                    />
                    <p className="font-semibold text-[#10203b]">{account.label}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-[#526787]">
                      {account.email}
                    </p>

                    {/* Copied badge */}
                    {wasCopied && (
                      <span
                        className="absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                        style={{ background: account.color }}
                      >
                        Copied
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      </div>{/* end island */}
    </div>
  );
}
