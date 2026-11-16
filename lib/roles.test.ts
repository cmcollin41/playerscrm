import { describe, expect, it } from "vitest"
import {
  isHigherOrEqualRole,
  isValidAccountRole,
  parseAccountRole,
  roleChangeProblem,
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

describe("roleChangeProblem", () => {
  it("blocks a non-owner granting owner", () => {
    expect(
      roleChangeProblem({ callerIsOwner: false, currentRole: null, newRole: "owner", ownerCount: 1 }),
    ).toContain("grant the owner role")
  })

  it("lets an owner grant owner", () => {
    expect(
      roleChangeProblem({ callerIsOwner: true, currentRole: null, newRole: "owner", ownerCount: 1 }),
    ).toBeNull()
  })

  it("blocks a non-owner changing an owner", () => {
    expect(
      roleChangeProblem({ callerIsOwner: false, currentRole: "owner", newRole: "member", ownerCount: 2 }),
    ).toContain("change an owner")
  })

  it("blocks demoting the last owner", () => {
    expect(
      roleChangeProblem({ callerIsOwner: true, currentRole: "owner", newRole: "admin", ownerCount: 1 }),
    ).toContain("at least one owner")
  })

  it("allows demoting an owner when another remains", () => {
    expect(
      roleChangeProblem({ callerIsOwner: true, currentRole: "owner", newRole: "admin", ownerCount: 2 }),
    ).toBeNull()
  })

  it("lets a non-owner change non-owner roles", () => {
    expect(
      roleChangeProblem({ callerIsOwner: false, currentRole: "member", newRole: "admin", ownerCount: 1 }),
    ).toBeNull()
  })
})
