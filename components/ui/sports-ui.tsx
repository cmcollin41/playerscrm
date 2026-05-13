import * as React from "react"

/**
 * Sports-forward UI primitives mirrored from the marketing home page mockups.
 * Used across the admin dashboard and parent portal to keep eyebrows, status
 * badges, and stat tiles visually consistent.
 */

// -----------------------------------------------------------------------------
// Eyebrow
// -----------------------------------------------------------------------------
export function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={`text-sm font-semibold uppercase tracking-wider text-orange-600 ${className}`}
    >
      {children}
    </p>
  )
}

// -----------------------------------------------------------------------------
// StatusBadge — tone-coded pill matching the home mockup palette.
// -----------------------------------------------------------------------------
export type StatusTone =
  | "emerald" // paid, confirmed, active, open
  | "amber" // due, pending, outstanding, waitlisted
  | "blue" // info, sent, draft
  | "rose" // failed, cancelled, void
  | "gray" // neutral, archived

const TONE_CLASSES: Record<StatusTone, string> = {
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700",
  rose: "bg-rose-50 text-rose-700",
  gray: "bg-gray-100 text-gray-600",
}

export function StatusBadge({
  tone = "gray",
  children,
  className = "",
}: {
  tone?: StatusTone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/**
 * Map common status/payment strings → tone. Centralized so pages don't
 * duplicate the lookup table.
 */
export function toneForStatus(
  status: string | null | undefined,
): StatusTone {
  if (!status) return "gray"
  const s = status.toLowerCase()
  if (
    s === "paid" ||
    s === "confirmed" ||
    s === "active" ||
    s === "open" ||
    s === "delivered" ||
    s === "sent"
  ) {
    return "emerald"
  }
  if (
    s === "due" ||
    s === "pending" ||
    s === "outstanding" ||
    s === "waitlisted" ||
    s === "scheduled" ||
    s === "draft"
  ) {
    return "amber"
  }
  if (s === "void" || s === "cancelled" || s === "canceled" || s === "failed" || s === "bounced") {
    return "rose"
  }
  if (s === "waived" || s === "info") {
    return "blue"
  }
  return "gray"
}

// -----------------------------------------------------------------------------
// StatTile — big display-font number with a tiny uppercase label.
// -----------------------------------------------------------------------------
export function StatTile({
  label,
  value,
  hint,
  tone,
  className = "",
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: "default" | "emerald" | "amber"
  className?: string
}) {
  const valueColor =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-gray-900"
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <div
        className={`mt-3 font-display text-3xl leading-none tracking-tight sm:text-4xl ${valueColor}`}
      >
        {value}
      </div>
      {hint && <p className="mt-2 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}
