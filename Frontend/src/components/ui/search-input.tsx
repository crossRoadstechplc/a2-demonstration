"use client";

import { cn } from "@/lib/utils";

interface SearchInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function SearchInput({
  placeholder = "Search",
  value = "",
  onChange,
  className,
}: SearchInputProps) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      className={cn(
        "h-10 w-full min-w-[180px] rounded-xl border border-border-subtle bg-background-muted px-3 text-sm text-foreground outline-none transition focus:border-accent",
        className
      )}
    />
  );
}
