import type { ComponentProps } from "react";
import "./Badge.css";

export type BadgeVariant = "neutral" | "accent" | "strong" | "muted" | "danger" | "count";

/**
 * A short label for a state, a role or a tag.
 * - neutral: white, black border (atual, reformatação)
 * - accent: yellow (publicada, Dono)
 * - strong: black (roles)
 * - muted: grey (não publicado)
 * - danger: red text and border (sem MIDI)
 * - count: a small black circle with a yellow number
 * `pill` rounds it fully, for tags and instruments.
 */
export function Badge({
  variant = "neutral",
  pill = false,
  className = "",
  ...props
}: ComponentProps<"span"> & { variant?: BadgeVariant; pill?: boolean }) {
  return (
    <span
      {...props}
      className={`ds-badge ${variant === "neutral" ? "" : `is-${variant}`} ${pill ? "is-pill" : ""} ${className}`}
    />
  );
}
