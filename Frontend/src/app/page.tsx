import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
      <section className="panel panel-padding w-full">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          A2 E-Corridor Frontend Foundation
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-foreground-muted md:text-base">
          App Router project scaffolded with reusable shell layout, global dark theme,
          Zustand stores, TanStack Query provider, and role route groups ready for
          business dashboard implementation.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {["a2", "station", "driver", "fleet", "freight", "eeu"].map((role) => (
            <Link
              key={role}
              href={`/${role}`}
              className="rounded-xl border border-border-subtle bg-background-muted px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
            >
              /{role}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
