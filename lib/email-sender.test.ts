import { describe, expect, it } from "vitest"
import { extractSenderEmail, isSenderAllowed } from "@/lib/email-sender"

describe("extractSenderEmail", () => {
  it("extracts and lowercases the bracketed address", () => {
    expect(extractSenderEmail("Jane Doe <Jane@Club.com>")).toBe("jane@club.com")
  })

  it("accepts a bare address", () => {
    expect(extractSenderEmail("jane@club.com")).toBe("jane@club.com")
  })

  it("returns null for an empty string", () => {
    expect(extractSenderEmail("")).toBeNull()
  })

  it("returns null when there is no address", () => {
    expect(extractSenderEmail("Jane Doe")).toBeNull()
  })

  it("uses the last bracketed address", () => {
    expect(extractSenderEmail("Evil <a@x.com> <jane@club.com>")).toBe(
      "jane@club.com",
    )
  })
})

describe("isSenderAllowed", () => {
  it("allows a case-insensitive match", () => {
    expect(
      isSenderAllowed("Jane <jane@club.com>", [{ email: "JANE@club.com" }]),
    ).toBe(true)
  })

  it("rejects an address not in the sender rows", () => {
    expect(
      isSenderAllowed("Jane <jane@other.com>", [{ email: "jane@club.com" }]),
    ).toBe(false)
  })

  it("rejects when there are no sender rows", () => {
    expect(isSenderAllowed("Jane <jane@club.com>", [])).toBe(false)
  })

  it("rejects an empty sender", () => {
    expect(isSenderAllowed("", [{ email: "jane@club.com" }])).toBe(false)
  })
})
