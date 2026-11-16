import { describe, expect, it } from "vitest"
import {
  calculateApplicationFeeCents,
  calculateApplicationFeeFromDollars,
} from "@/lib/fees"

describe("calculateApplicationFeeCents", () => {
  it("adds the percentage and the flat fee", () => {
    expect(
      calculateApplicationFeeCents(10000, {
        application_fee: 7,
        application_fee_flat: 100,
      }),
    ).toBe(800)
  })

  it("applies only the percentage when there is no flat fee", () => {
    expect(calculateApplicationFeeCents(10000, { application_fee: 7 })).toBe(700)
  })

  it("applies only the flat fee when there is no percentage", () => {
    expect(
      calculateApplicationFeeCents(10000, { application_fee_flat: 100 }),
    ).toBe(100)
  })

  it("returns 0 for an empty config", () => {
    expect(calculateApplicationFeeCents(10000, {})).toBe(0)
  })

  it("returns 0 when both fees are null", () => {
    expect(
      calculateApplicationFeeCents(10000, {
        application_fee: null,
        application_fee_flat: null,
      }),
    ).toBe(0)
  })

  it("rounds the percentage portion (70.35 rounds down to 70)", () => {
    expect(calculateApplicationFeeCents(1005, { application_fee: 7 })).toBe(70)
  })

  it("can exceed the charge amount", () => {
    // documents current behavior: the fee (104) exceeds the charge (50). Stripe rejects this; capping is a separate decision.
    expect(
      calculateApplicationFeeCents(50, {
        application_fee: 7,
        application_fee_flat: 100,
      }),
    ).toBe(104)
  })
})

describe("calculateApplicationFeeFromDollars", () => {
  it("converts dollars to cents and rounds the fee", () => {
    expect(
      calculateApplicationFeeFromDollars(19.99, { application_fee: 7 }),
    ).toBe(140)
  })

  it("adds the flat fee on whole-dollar amounts", () => {
    expect(
      calculateApplicationFeeFromDollars(100, {
        application_fee: 7,
        application_fee_flat: 100,
      }),
    ).toBe(800)
  })
})
