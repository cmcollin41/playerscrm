/**
 * The only place cents and dollars are converted or formatted.
 *
 * Units in this codebase:
 *   - dollars: invoices.amount, payments.amount, rosters.custom_amount,
 *     fees.amount
 *   - integer cents: events.fee_amount, every *_cents column,
 *     accounts.application_fee_flat, and everything sent to or received
 *     from Stripe
 *
 * Name variables after their unit (amountCents, totalDollars) and convert
 * with these functions, never with a bare "/ 100" or "* 100".
 */

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

/** Dollars to integer cents, rounded to the nearest cent. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/** Integer cents to dollars (a number, for storing in a dollars column). */
export function centsToDollars(cents: number): number {
  return cents / 100
}

/** Integer cents as a plain decimal string with no symbol, e.g. 1250 -> "12.50". */
export function centsToDecimalString(cents: number): string {
  return centsToDollars(cents).toFixed(2)
}

/** Integer cents as US currency, e.g. 123450 -> "$1,234.50". */
export function formatCents(cents: number): string {
  return USD.format(centsToDollars(cents))
}

/** Dollars as US currency, e.g. 1234.5 -> "$1,234.50". Accepts numeric strings from the database. */
export function formatDollars(dollars: number | string | null | undefined): string {
  const value = Number(dollars ?? 0)
  return USD.format(Number.isFinite(value) ? value : 0)
}
