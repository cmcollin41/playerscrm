const PLATFORM_DOMAIN = "e.athletes.app"
const PLATFORM_INVOICE_LOCALPART = "invoices"
const PLATFORM_DEFAULT_LOCALPART = "noreply"

export type SenderPurpose = "invoice" | "default"

interface SenderRow {
  id?: string | null
  email?: string | null
  name?: string | null
}

interface AccountForSender {
  name?: string | null
  senders?: SenderRow[] | null
  default_invoice_sender_id?: string | null
  default_sender_id?: string | null
}

/**
 * Resolve the "From" header for an outgoing email.
 *
 * Preference order:
 *  1. Account's explicit per-purpose default (accounts.default_invoice_sender_id
 *     or accounts.default_sender_id), if set and present in the senders list.
 *  2. Heuristic on the account's senders:
 *       invoice -> any sender with "invoice" in the local-part
 *       default -> first sender
 *  3. Platform-managed fallback on PLATFORM_DOMAIN:
 *       invoice -> invoices@PLATFORM_DOMAIN
 *       default -> noreply@PLATFORM_DOMAIN
 *
 * Display name is always the account name when available.
 */
export function resolveSender(
  account: AccountForSender | null | undefined,
  purpose: SenderPurpose = "default",
): string {
  const accountName = account?.name?.trim() || "Athletes"
  const senders = (account?.senders || []).filter(
    (s): s is SenderRow & { email: string } => !!s.email,
  )

  const explicitId =
    purpose === "invoice"
      ? account?.default_invoice_sender_id
      : account?.default_sender_id

  if (explicitId) {
    const explicit = senders.find((s) => s.id === explicitId)
    if (explicit) {
      return `${accountName} <${explicit.email}>`
    }
  }

  if (senders.length > 0) {
    let chosen: SenderRow & { email: string }
    if (purpose === "invoice") {
      chosen =
        senders.find((s) => s.email.toLowerCase().startsWith("invoice")) ||
        senders.find((s) => s.email.toLowerCase().includes("invoice")) ||
        senders[0]
    } else {
      chosen = senders[0]
    }
    return `${accountName} <${chosen.email}>`
  }

  const localpart =
    purpose === "invoice"
      ? PLATFORM_INVOICE_LOCALPART
      : PLATFORM_DEFAULT_LOCALPART
  return `${accountName} <${localpart}@${PLATFORM_DOMAIN}>`
}
