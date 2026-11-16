import { describe, expect, it } from "vitest"
import { resolveInvoiceStatus } from "./invoice-status"

describe("resolveInvoiceStatus", () => {
  const cases: [string | null, string, string][] = [
    ["draft", "sent", "sent"],
    ["sent", "draft", "sent"],
    ["sent", "paid", "paid"],
    ["paid", "draft", "paid"],
    ["paid", "sent", "paid"],
    ["paid", "overdue", "paid"],
    ["paid", "void", "paid"],
    ["void", "sent", "void"],
    ["overdue", "sent", "overdue"],
    ["overdue", "paid", "paid"],
    ["sent", "void", "void"],
    [null, "sent", "sent"],
    ["something-else", "sent", "sent"],
    ["sent", "something-else", "sent"],
  ]

  it.each(cases)("current %s + incoming %s -> %s", (current, incoming, expected) => {
    expect(resolveInvoiceStatus(current, incoming)).toBe(expected)
  })
})
