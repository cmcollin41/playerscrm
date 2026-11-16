const RANK: Record<string, number> = {
  draft: 0,
  sent: 1,
  overdue: 2,
  paid: 3,
  void: 3,
}

/**
 * Decide the status to store when a Stripe invoice event arrives.
 * Events can arrive out of order, so status only ever moves forward:
 * draft → sent → overdue → paid/void. paid and void are final.
 */
export function resolveInvoiceStatus(
  current: string | null | undefined,
  incoming: string,
): string {
  if (!current || !(current in RANK)) return incoming
  if (!(incoming in RANK)) return current
  if (current === "paid" || current === "void") return current
  return RANK[incoming] >= RANK[current] ? incoming : current
}
