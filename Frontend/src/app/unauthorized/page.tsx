import Link from "next/link";

import { LOGIN_ROUTE } from "@/constants/routes";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center p-6">
      <section className="panel panel-padding w-full text-center">
        <p className="type-label">Access Control</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Unauthorized</h1>
        <p className="mt-3 text-sm text-foreground-muted">
          Your account role does not have permission to view this dashboard route.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-xl border border-border-subtle bg-background-muted px-4 py-2 text-sm text-foreground transition hover:border-accent hover:text-accent"
          >
            Go Home
          </Link>
          <Link
            href={LOGIN_ROUTE}
            className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/15"
          >
            Switch Account
          </Link>
        </div>
      </section>
    </main>
  );
}
