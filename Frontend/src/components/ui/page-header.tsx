import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className="panel card-regular flex items-start justify-between gap-4">
      <div>
        {eyebrow ? <p className="type-label">{eyebrow}</p> : null}
        <h2 className="type-heading mt-1">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm text-foreground-muted">{description}</p>
        ) : null}
      </div>
      {actions}
    </header>
  );
}
