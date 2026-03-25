/**
 * DRY invoice $ math for dashboards, roster logic, and list UIs.
 * Status values match DB: draft | sent | paid | void | overdue
 */

export interface InvoiceLike {
  status?: string | null;
  amount?: number | string | null;
  created_at?: string | null;
  roster_id?: string | null;
}

export function invoiceAmountDollars(inv: InvoiceLike): number {
  return Number(inv.amount ?? 0);
}

export function sumInvoiceAmounts(
  invoices: readonly InvoiceLike[] | null | undefined,
  predicate: (inv: InvoiceLike) => boolean,
): number {
  if (!invoices?.length) return 0;
  let s = 0;
  for (const inv of invoices) {
    if (predicate(inv)) s += invoiceAmountDollars(inv);
  }
  return s;
}

export function sumAllInvoiceAmounts(
  invoices: readonly InvoiceLike[] | null | undefined,
): number {
  return sumInvoiceAmounts(invoices, () => true);
}

export function sumPaidInvoiceAmounts(
  invoices: readonly InvoiceLike[] | null | undefined,
): number {
  return sumInvoiceAmounts(invoices, (inv) => inv.status === "paid");
}

export function sumSentInvoiceAmounts(
  invoices: readonly InvoiceLike[] | null | undefined,
): number {
  return sumInvoiceAmounts(invoices, (inv) => inv.status === "sent");
}

export function filterInvoicesSentOrPaid(
  invoices: readonly InvoiceLike[] | null | undefined,
): InvoiceLike[] {
  if (!invoices?.length) return [];
  return invoices.filter(
    (inv) => inv.status === "sent" || inv.status === "paid",
  );
}

export function filterInvoicesAttachedToRoster<
  T extends { roster_id?: string | null },
>(invoices: readonly T[] | null | undefined): T[] {
  if (!invoices?.length) return [];
  return invoices.filter(
    (inv) =>
      inv.roster_id != null && String(inv.roster_id).replace(/\s/g, "") !== "",
  );
}

export function filterInvoicesNotAttachedToRoster<
  T extends { roster_id?: string | null },
>(invoices: readonly T[] | null | undefined): T[] {
  if (!invoices?.length) return [];
  return invoices.filter(
    (inv) =>
      inv.roster_id == null ||
      String(inv.roster_id).replace(/\s/g, "") === "",
  );
}

export function countInvoicesWithStatus(
  invoices: readonly InvoiceLike[] | null | undefined,
  status: string,
): number {
  if (!invoices?.length) return 0;
  let n = 0;
  for (const inv of invoices) {
    if (inv.status === status) n++;
  }
  return n;
}

export function countInvoicesWhere(
  invoices: readonly InvoiceLike[] | null | undefined,
  predicate: (inv: InvoiceLike) => boolean,
): number {
  if (!invoices?.length) return 0;
  let n = 0;
  for (const inv of invoices) {
    if (predicate(inv)) n++;
  }
  return n;
}

export interface PaymentRecordLike {
  status?: string | null;
  amount?: number | string | null;
}

export function sumPaymentAmounts(
  payments: readonly PaymentRecordLike[] | null | undefined,
  predicate: (p: PaymentRecordLike) => boolean,
): number {
  if (!payments?.length) return 0;
  let s = 0;
  for (const p of payments) {
    if (predicate(p)) s += Number(p.amount ?? 0);
  }
  return s;
}

export function sumSucceededPaymentAmounts(
  payments: readonly PaymentRecordLike[] | null | undefined,
): number {
  return sumPaymentAmounts(
    payments,
    (p) => String(p.status).toLowerCase() === "succeeded",
  );
}
