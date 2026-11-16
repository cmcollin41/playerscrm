interface SenderRow {
  email?: string | null
}

/** "Jane Doe <jane@club.com>" → "jane@club.com"; "jane@club.com" → "jane@club.com". */
export function extractSenderEmail(sender: string): string | null {
  const raw = String(sender || "").trim()
  if (!raw) return null
  const match = raw.match(/<([^<>\s]+)>\s*$/)
  const email = (match ? match[1] : raw).trim().toLowerCase()
  if (!/^[^\s@<>]+@[^\s@<>]+$/.test(email)) return null
  return email
}

/** True only when the sender's address is one of the account's sender rows. */
export function isSenderAllowed(sender: string, senders: SenderRow[]): boolean {
  const email = extractSenderEmail(sender)
  if (!email) return false
  return senders.some(
    (s) => typeof s.email === "string" && s.email.trim().toLowerCase() === email,
  )
}
