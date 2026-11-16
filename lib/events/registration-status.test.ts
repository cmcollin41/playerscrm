import { describe, expect, it } from "vitest"
import { confirmedPersonIds, isHoldingRegistration } from "./registration-status"

describe("isHoldingRegistration", () => {
  it("holds for confirmed", () => {
    expect(isHoldingRegistration("confirmed")).toBe(true)
  })
  it("holds for waitlisted", () => {
    expect(isHoldingRegistration("waitlisted")).toBe(true)
  })
  it("does not hold for pending", () => {
    expect(isHoldingRegistration("pending")).toBe(false)
  })
  it("does not hold for cancelled", () => {
    expect(isHoldingRegistration("cancelled")).toBe(false)
  })
  it("does not hold for null", () => {
    expect(isHoldingRegistration(null)).toBe(false)
  })
})

describe("confirmedPersonIds", () => {
  it("returns only confirmed person ids", () => {
    expect(
      confirmedPersonIds([
        { person_id: "a", status: "confirmed" },
        { person_id: "b", status: "pending" },
        { person_id: "c", status: "cancelled" },
      ]),
    ).toEqual(["a"])
  })
  it("returns an empty array for no rows", () => {
    expect(confirmedPersonIds([])).toEqual([])
  })
})
