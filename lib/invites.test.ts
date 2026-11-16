import { describe, expect, it } from "vitest"
import {
  generateInviteToken,
  inviteProblem,
  isInviteTokenFormat,
  type AccountInvitation,
} from "@/lib/invites"

const now = new Date("2026-11-16T12:00:00.000Z")

function makeInvite(overrides: Partial<AccountInvitation> = {}): AccountInvitation {
  return {
    id: "inv-1",
    account_id: "acc-1",
    email: "jane@club.com",
    role: "member",
    people_id: null,
    expires_at: new Date(now.getTime() + 60_000).toISOString(),
    accepted_at: null,
    ...overrides,
  }
}

describe("generateInviteToken", () => {
  it("returns distinct, well-formed tokens", () => {
    const a = generateInviteToken()
    const b = generateInviteToken()
    expect(a).not.toBe(b)
    expect(isInviteTokenFormat(a)).toBe(true)
    expect(isInviteTokenFormat(b)).toBe(true)
  })
})

describe("isInviteTokenFormat", () => {
  it("rejects malformed values", () => {
    expect(isInviteTokenFormat("")).toBe(false)
    expect(isInviteTokenFormat("abc")).toBe(false)
    expect(isInviteTokenFormat("' or 1=1 --")).toBe(false)
  })

  it("accepts a uuid", () => {
    expect(isInviteTokenFormat("3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c")).toBe(true)
  })
})

describe("inviteProblem", () => {
  it("rejects a missing invitation", () => {
    expect(inviteProblem(null, "a@x.com", now)).toContain("not valid")
  })

  it("rejects a used invitation", () => {
    const invite = makeInvite({ accepted_at: now.toISOString() })
    expect(inviteProblem(invite, "jane@club.com", now)).toContain("already been used")
  })

  it("rejects an expired invitation", () => {
    const invite = makeInvite({
      expires_at: new Date(now.getTime() - 1000).toISOString(),
    })
    expect(inviteProblem(invite, "jane@club.com", now)).toContain("expired")
  })

  it("accepts a matching email ignoring case and whitespace", () => {
    const invite = makeInvite({ email: "Jane@Club.com" })
    expect(inviteProblem(invite, " jane@club.com ", now)).toBeNull()
  })

  it("rejects a different email", () => {
    const invite = makeInvite()
    expect(inviteProblem(invite, "mallory@club.com", now)).toContain("different email")
  })
})
