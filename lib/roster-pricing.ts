/**
 * Roster billing: owed amount, paid status, and Stripe fee + invoice collections.
 * Shared invoice $ helpers: `lib/invoice-aggregates.ts`.
 */
import {
  sumPaidInvoiceAmounts,
  sumPaymentAmounts,
} from "./invoice-aggregates"

/**
 * The roster's fee: custom override or catalog amount.
 * This is what the player owes for the roster spot — the source of truth
 * for paid/partial/unpaid status. Invoices are payments against this fee.
 */
export function rosterTemplateDollars(roster: any): number | null {
  if (!roster) return null
  if (
    roster.custom_amount != null &&
    roster.custom_amount !== "" &&
    Number(roster.custom_amount) > 0
  ) {
    return Number(roster.custom_amount)
  }
  const fa = roster?.fees?.amount
  if (fa != null && Number(fa) > 0) return Number(fa)
  return null
}

function dollarsToCents(value: number): number {
  return Math.round(value * 100)
}

/**
 * All non-void invoices tied to this roster (installments, etc.).
 * Newest first (`created_at` desc) when present.
 */
export function invoicesForRoster(roster: any): any[] {
  const person = roster?.people
  const id = roster?.id
  if (!person?.invoices?.length || !id) return []
  const list = person.invoices
    .filter(
      (inv: { roster_id?: string; status?: string }) =>
        inv.roster_id === id && inv.status !== "void",
    )
    .slice()
  return list.sort((a: any, b: any) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0
    const tb = b.created_at ? Date.parse(b.created_at) : 0
    return tb - ta
  })
}

/** Sum of all invoice amounts for this roster (total ever invoiced). */
export function rosterTotalInvoicedDollars(roster: any): number {
  return invoicesForRoster(roster).reduce(
    (sum: number, inv: any) =>
      sum + (inv.amount != null ? Number(inv.amount) : 0),
    0,
  )
}

/** Sum of paid invoice amounts for this roster. */
export function rosterPaidInvoiceTotalDollars(roster: any): number {
  return sumPaidInvoiceAmounts(invoicesForRoster(roster))
}

/**
 * What this roster still owes: fee amount minus total collected.
 * Returns null when no fee is set.
 */
export function effectiveRosterOwedDollars(roster: any): number | null {
  const fee = rosterTemplateDollars(roster)
  if (fee == null || fee <= 0) return null
  const collected = rosterTotalPaidCollectedDollars(roster)
  const remaining = fee - collected
  return remaining > 0 ? remaining : 0
}

/**
 * Sum of succeeded roster fee `payments.amount` for this person + roster fee
 * (Stripe PaymentIntent / roster checkout).
 */
export function rosterPaidFeePaymentTotalDollars(roster: any): number {
  const rf = roster?.fees
  const personId = roster?.person_id
  if (!rf?.payments?.length || !personId || !rf.id) return 0
  const rows = rf.payments.filter(
    (p: { person_id: string; fee_id: string; status: string }) =>
      p.person_id === personId &&
      p.fee_id === rf.id &&
      p.status === "succeeded",
  )
  return sumPaymentAmounts(rows, () => true)
}

/** Fee payments + paid invoices (actual dollars collected on this roster). */
export function rosterTotalPaidCollectedDollars(roster: any): number {
  return (
    rosterPaidFeePaymentTotalDollars(roster) +
    rosterPaidInvoiceTotalDollars(roster)
  )
}

/**
 * One "primary" invoice for UI: newest attached to this roster.
 * Prefer {@link invoicesForRoster} when behavior should include every installment.
 */
export function linkedInvoiceForRoster(roster: any) {
  const list = invoicesForRoster(roster)
  return list[0]
}

/** At least one succeeded fee payment exists for this roster line (card checkout). */
export function rosterPaidViaFeePayment(roster: any): boolean {
  return rosterPaidFeePaymentTotalDollars(roster) > 0
}

/**
 * Roster fully paid: manual override takes precedence, otherwise
 * total collected (fee payments + paid invoices) covers the fee amount.
 */
export function rosterIsPaid(roster: any): boolean {
  if (roster?.payment_status === "paid" || roster?.payment_status === "waived")
    return true
  const fee = rosterTemplateDollars(roster)
  if (fee == null || fee <= 0) return false
  return (
    dollarsToCents(rosterTotalPaidCollectedDollars(roster)) >=
    dollarsToCents(fee)
  )
}

export function rosterPaidViaInvoices(roster: any): boolean {
  const fee = rosterTemplateDollars(roster)
  if (fee == null || fee <= 0) return false
  const paidSum = rosterPaidInvoiceTotalDollars(roster)
  return dollarsToCents(paidSum) >= dollarsToCents(fee)
}

/**
 * Some payment captured but not fully covering the fee amount.
 */
export function rosterPartiallyPaidViaInvoices(roster: any): boolean {
  const fee = rosterTemplateDollars(roster)
  if (fee == null || fee <= 0) return false
  const total = rosterTotalPaidCollectedDollars(roster)
  const tc = dollarsToCents(total)
  const fc = dollarsToCents(fee)
  return tc > 0 && tc < fc
}

export function rosterPaidViaLinkedInvoice(roster: any): boolean {
  return rosterPaidViaInvoices(roster)
}

/**
 * Dollars actually collected: succeeded fee `payments.amount` + paid invoice amounts.
 */
export function rosterCollectedDollars(roster: any): number {
  const n = rosterTotalPaidCollectedDollars(roster)
  return n > 0 ? n : 0
}

export function unpaidSentInvoicesForRoster(roster: any): any[] {
  return invoicesForRoster(roster)
    .filter((inv) => inv.status === "sent")
    .slice()
    .sort((a, b) => {
      const da = a.due_date ? Date.parse(a.due_date) : Number.POSITIVE_INFINITY
      const db = b.due_date ? Date.parse(b.due_date) : Number.POSITIVE_INFINITY
      return da - db
    })
}

export function amountsDifferCents(a: number, b: number) {
  return Math.round(a * 100) !== Math.round(b * 100)
}

/**
 * Person's roster spot: manual override, no fee assigned, or collected >= fee.
 */
export function hasPaidFee(person: any, roster: any): boolean {
  if (!person?.id || !roster) return false
  if (roster.person_id !== person.id) return false
  if (roster.payment_status === "paid" || roster.payment_status === "waived")
    return true
  const fee = rosterTemplateDollars(roster)
  if (fee == null || fee <= 0) return true
  return rosterIsPaid(roster)
}
