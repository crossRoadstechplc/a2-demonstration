"use client";

import { cn } from "@/lib/utils";

interface AsyncActionButtonProps {
  label: string;
  loadingLabel?: string;
  loading?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "primary" | "outline" | "danger";
  className?: string;
}

const variantStyles = {
  primary: "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20",
  outline: "border-border-subtle bg-background-muted text-foreground hover:border-accent hover:text-accent",
  danger: "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
} as const;

export function AsyncActionButton({
  label,
  loadingLabel = "Working...",
  loading = false,
  onClick,
  type = "button",
  disabled = false,
  variant = "primary",
  className,
}: AsyncActionButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variantStyles[variant],
        className
      )}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
