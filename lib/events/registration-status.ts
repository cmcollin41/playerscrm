interface RegistrationRow {
  person_id: string
  status: string | null
}

/** Statuses that mean "this person holds a spot" on the registration page. */
export function isHoldingRegistration(status: string | null | undefined): boolean {
  return status === "confirmed" || status === "waitlisted"
}

/** Person ids that are already confirmed and so must not be re-registered. */
export function confirmedPersonIds(rows: RegistrationRow[]): string[] {
  return rows.filter((r) => r.status === "confirmed").map((r) => r.person_id)
}
