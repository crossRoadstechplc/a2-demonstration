interface TrendCardProps {
  title: string;
  subtitle?: string;
}

export function TrendCard({ title, subtitle }: TrendCardProps) {
  return (
    <article className="panel card-regular">
      <p className="type-label">{title}</p>
      {subtitle ? <p className="mt-1 text-sm text-foreground-muted">{subtitle}</p> : null}
      <div className="mt-4 h-24 rounded-xl border border-border-subtle bg-background-muted p-2">
        <div className="h-full w-full rounded-md bg-[linear-gradient(90deg,transparent_0%,rgba(35,201,255,0.35)_45%,transparent_100%)]" />
      </div>
    </article>
  );
}
