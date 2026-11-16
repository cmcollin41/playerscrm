import { describe, expect, it } from "vitest"
import {
  centsToDecimalString,
  centsToDollars,
  dollarsToCents,
  formatCents,
  formatDollars,
} from "./money"

describe("dollarsToCents", () => {
  it("converts whole dollars", () => {
    expect(dollarsToCents(150)).toBe(15000)
  })
  it("converts decimals", () => {
    expect(dollarsToCents(19.99)).toBe(1999)
  })
  it("rounds floating point error", () => {
    expect(dollarsToCents(0.1 + 0.2)).toBe(30)
  })
  it("always returns an integer", () => {
    expect(Number.isInteger(dollarsToCents(1.005))).toBe(true)
  })
  it("propagates NaN", () => {
    expect(Number.isNaN(dollarsToCents(NaN))).toBe(true)
  })
})

describe("centsToDollars", () => {
  it("converts cents", () => {
    expect(centsToDollars(15000)).toBe(150)
    expect(centsToDollars(1999)).toBe(19.99)
  })
  it("round-trips", () => {
    expect(centsToDollars(dollarsToCents(45.5))).toBe(45.5)
  })
})

describe("centsToDecimalString", () => {
  it("formats with two decimals", () => {
    expect(centsToDecimalString(1250)).toBe("12.50")
    expect(centsToDecimalString(5)).toBe("0.05")
    expect(centsToDecimalString(0)).toBe("0.00")
  })
})

describe("formatCents", () => {
  it("formats as currency", () => {
    expect(formatCents(5000)).toBe("$50.00")
    expect(formatCents(123450)).toBe("$1,234.50")
  })
})

describe("formatDollars", () => {
  it("formats numbers and numeric strings", () => {
    expect(formatDollars(50)).toBe("$50.00")
    expect(formatDollars("150.00")).toBe("$150.00")
  })
  it("falls back to zero", () => {
    expect(formatDollars(null)).toBe("$0.00")
    expect(formatDollars("abc")).toBe("$0.00")
  })
})
