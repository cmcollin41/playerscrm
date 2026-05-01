interface AccountFeeConfig {
  application_fee?: number | null
  application_fee_flat?: number | null
}

export function calculateApplicationFeeCents(
  amountCents: number,
  account: AccountFeeConfig,
): number {
  const percent = account.application_fee ?? 0
  const flat = account.application_fee_flat ?? 0
  if (percent <= 0 && flat <= 0) return 0
  return Math.round(amountCents * (percent / 100)) + flat
}

export function calculateApplicationFeeFromDollars(
  amountDollars: number,
  account: AccountFeeConfig,
): number {
  return calculateApplicationFeeCents(
    Math.round(amountDollars * 100),
    account,
  )
}
