import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center p-6">
      <section className="panel panel-padding w-full text-center">
        <p className="type-label">Navigation</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Page Not Found</h1>
        <p className="mt-3 text-sm text-foreground-muted">
          The route you requested does not exist in this dashboard environment.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/15"
          >
            Return to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
