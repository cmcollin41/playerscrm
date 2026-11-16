import { describe, expect, it } from "vitest"
import {
  isHigherOrEqualRole,
  isValidAccountRole,
  parseAccountRole,
} from "@/lib/roles"

describe("parseAccountRole", () => {
  it("keeps valid roles", () => {
    expect(parseAccountRole("admin")).toBe("admin")
  })

  it("is case-insensitive", () => {
    expect(parseAccountRole("ADMIN")).toBe("admin")
  })

  it("maps legacy general to member", () => {
    expect(parseAccountRole("general")).toBe("member")
  })

  it("falls back to member for unknown values", () => {
    expect(parseAccountRole("bogus")).toBe("member")
  })

  it("falls back to member for null and undefined", () => {
    expect(parseAccountRole(null)).toBe("member")
    expect(parseAccountRole(undefined)).toBe("member")
  })
})

describe("isValidAccountRole", () => {
  it("accepts owner", () => {
    expect(isValidAccountRole("owner")).toBe(true)
  })

  it("rejects the legacy general role", () => {
    expect(isValidAccountRole("general")).toBe(false)
  })
})

describe("isHigherOrEqualRole", () => {
  it("owner outranks admin", () => {
    expect(isHigherOrEqualRole("owner", "admin")).toBe(true)
  })

  it("equal roles are higher-or-equal", () => {
    expect(isHigherOrEqualRole("admin", "admin")).toBe(true)
  })

  it("member does not reach manager", () => {
    expect(isHigherOrEqualRole("member", "manager")).toBe(false)
  })
})
