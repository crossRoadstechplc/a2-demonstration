interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "Loading..." }: LoadingStateProps) {
  return (
    <div className="panel panel-padding flex items-center gap-3 rounded-xl border border-border-subtle bg-background-muted/50">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-foreground-muted border-t-accent" />
      <p className="text-sm text-foreground-muted">{label}</p>
    </div>
  );
}
