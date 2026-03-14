import { cn } from "@/lib/utils";

export type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral";

const variantStyles: Record<StatusVariant, string> = {
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
  info: "border-info/40 bg-info/10 text-info",
  neutral: "border-neutral/40 bg-neutral/10 text-neutral",
};

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  size?: "sm" | "md";
}

const sizeStyles = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-[11px]",
} as const;

export function statusVariantFromLabel(label: string): StatusVariant {
  const normalized = label.toLowerCase();
  if (
    normalized.includes("active") ||
    normalized.includes("ready") ||
    normalized.includes("delivered") ||
    normalized.includes("success")
  ) {
    return "success";
  }
  if (
    normalized.includes("fault") ||
    normalized.includes("critical") ||
    normalized.includes("error") ||
    normalized.includes("maintenance")
  ) {
    return "danger";
  }
  if (
    normalized.includes("pending") ||
    normalized.includes("warning") ||
    normalized.includes("queue")
  ) {
    return "warning";
  }
  if (normalized.includes("live") || normalized.includes("transit") || normalized.includes("info")) {
    return "info";
  }
  return "neutral";
}

export function StatusBadge({
  label,
  variant = "neutral",
  size = "sm",
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-semibold uppercase tracking-[0.14em]",
        sizeStyles[size],
        variantStyles[variant]
      )}
    >
      {label}
    </span>
  );
}
