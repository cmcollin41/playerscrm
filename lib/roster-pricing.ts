/** Catalog/custom dollars owed for this roster row (null = no billable amount). */
export function effectiveRosterOwedDollars(roster: any): number | null {
  if (!roster) return null;
  if (
    roster.custom_amount != null &&
    roster.custom_amount !== "" &&
    Number(roster.custom_amount) > 0
  ) {
    return Number(roster.custom_amount);
  }
  const fa = roster.fees?.amount;
  if (fa != null && Number(fa) > 0) return Number(fa);
  return null;
}

/** Invoice row linked to this roster spot (people.invoices where roster_id matches). */
export function linkedInvoiceForRoster(roster: any) {
  const person = roster?.people;
  const id = roster?.id;
  if (!person?.invoices?.length || !id) return undefined;
  return person.invoices.find((inv: { roster_id?: string }) => inv.roster_id === id);
}

export function rosterPaidViaFeePayment(roster: any): boolean {
  const rf = roster?.fees;
  const personId = roster?.person_id;
  if (!rf?.payments?.length || !personId || !rf.id) return false;
  return rf.payments.some(
    (p: { person_id: string; fee_id: string; status: string }) =>
      p.person_id === personId &&
      p.fee_id === rf.id &&
      p.status === "succeeded",
  );
}

export function rosterPaidViaLinkedInvoice(roster: any): boolean {
  const inv = linkedInvoiceForRoster(roster);
  return inv?.status === "paid";
}

/** Matches roster table billing: paid via Stripe fee payment or paid linked invoice. */
export function rosterIsPaid(roster: any): boolean {
  return rosterPaidViaFeePayment(roster) || rosterPaidViaLinkedInvoice(roster);
}

/** Dollars for "collected" team stats when this roster is paid (roster price, else invoice amount). */
export function rosterCollectedDollars(roster: any): number {
  if (!rosterIsPaid(roster)) return 0;
  const owed = effectiveRosterOwedDollars(roster);
  if (owed != null && owed > 0) return owed;
  const inv = linkedInvoiceForRoster(roster);
  const amt = inv?.amount;
  if (amt != null && Number(amt) > 0) return Number(amt);
  return 0;
}

export function amountsDifferCents(a: number, b: number) {
  return Math.round(a * 100) !== Math.round(b * 100);
}
