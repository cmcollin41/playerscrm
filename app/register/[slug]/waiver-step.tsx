"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface WaiverForRegister {
  waiver_id: string
  is_required: boolean
  requires_guardian: boolean
  ordering: number
  waivers: {
    id: string
    title: string
    body: string
  } | null
}

export interface WaiverRegistrant {
  id: string
  first_name: string | null
  last_name: string | null
  dependent: boolean
  birthdate?: string | null
}

export interface WaiverSignature {
  signer_name: string
  signer_relationship: "self" | "guardian" | "other"
  accepted: boolean
}

// key: `${personId}:${waiverId}`
export type WaiverSignatures = Record<string, WaiverSignature>

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25

export function isMinor(birthdate: string | null | undefined): boolean {
  if (!birthdate) return false
  const d = new Date(birthdate)
  if (isNaN(d.getTime())) return false
  const ageMs = Date.now() - d.getTime()
  return ageMs / MS_PER_YEAR < 18
}

export function defaultRelationship(
  registrant: WaiverRegistrant,
  waiver: WaiverForRegister,
): "self" | "guardian" {
  if (waiver.requires_guardian) return "guardian"
  if (registrant.dependent) return "guardian"
  if (isMinor(registrant.birthdate)) return "guardian"
  return "self"
}

export function waiverKey(personId: string, waiverId: string): string {
  return `${personId}:${waiverId}`
}

export function signaturesAreComplete(args: {
  registrants: WaiverRegistrant[]
  waivers: WaiverForRegister[]
  signatures: WaiverSignatures
}): { complete: boolean; reason?: string } {
  const required = args.waivers.filter((w) => w.is_required)
  for (const w of required) {
    if (!w.waivers) continue
    for (const r of args.registrants) {
      const sig = args.signatures[waiverKey(r.id, w.waiver_id)]
      if (!sig?.accepted) {
        return {
          complete: false,
          reason: `${w.waivers.title} not signed for ${displayName(r)}`,
        }
      }
      if (!sig.signer_name.trim()) {
        return {
          complete: false,
          reason: `Signer name required for ${w.waivers.title}`,
        }
      }
    }
  }
  return { complete: true }
}

function displayName(r: WaiverRegistrant): string {
  const n = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
  return n || "this registrant"
}

export function WaiverStep({
  registrants,
  waivers,
  signatures,
  onSignaturesChange,
}: {
  registrants: WaiverRegistrant[]
  waivers: WaiverForRegister[]
  signatures: WaiverSignatures
  onSignaturesChange: (next: WaiverSignatures) => void
}) {
  const sorted = [...waivers].sort((a, b) => a.ordering - b.ordering)

  function patch(
    personId: string,
    waiverId: string,
    patchValue: Partial<WaiverSignature>,
  ) {
    const key = waiverKey(personId, waiverId)
    const current = signatures[key] ?? {
      signer_name: "",
      signer_relationship: "self" as const,
      accepted: false,
    }
    onSignaturesChange({
      ...signatures,
      [key]: { ...current, ...patchValue },
    })
  }

  return (
    <div className="space-y-4">
      {sorted.map((w) => {
        const template = w.waivers
        if (!template) return null
        return (
          <Card key={w.waiver_id}>
            <CardHeader>
              <CardTitle className="text-base">
                {template.title}
                {w.is_required && (
                  <span className="ml-2 text-xs font-normal text-red-600">
                    Required
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Please read the full text below, then enter your name and
                accept for each registrant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
                {template.body}
              </div>

              {registrants.map((r) => {
                const key = waiverKey(r.id, w.waiver_id)
                const current =
                  signatures[key] ?? {
                    signer_name: "",
                    signer_relationship: defaultRelationship(r, w),
                    accepted: false,
                  }
                const guardianForced =
                  w.requires_guardian ||
                  r.dependent ||
                  isMinor(r.birthdate)

                return (
                  <div
                    key={r.id}
                    className="rounded-md border border-gray-200 p-3"
                  >
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                      For {displayName(r)}
                    </p>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {current.signer_relationship === "guardian"
                            ? "Guardian's full legal name"
                            : "Your full legal name"}{" "}
                          *
                        </Label>
                        <Input
                          value={current.signer_name}
                          onChange={(e) =>
                            patch(r.id, w.waiver_id, {
                              signer_name: e.target.value,
                            })
                          }
                          placeholder="Type your full name"
                        />
                      </div>
                      {!guardianForced && (
                        <div className="space-y-1">
                          <Label className="text-xs">Signing as</Label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                            value={current.signer_relationship}
                            onChange={(e) =>
                              patch(r.id, w.waiver_id, {
                                signer_relationship: e.target
                                  .value as WaiverSignature["signer_relationship"],
                              })
                            }
                          >
                            <option value="self">Myself</option>
                            <option value="guardian">Parent / guardian</option>
                            <option value="other">Other authorized adult</option>
                          </select>
                        </div>
                      )}
                      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={current.accepted}
                          onChange={(e) =>
                            patch(r.id, w.waiver_id, {
                              accepted: e.target.checked,
                            })
                          }
                        />
                        <span className="text-xs text-gray-700">
                          I have read and agree to the {template.title} on
                          behalf of {displayName(r)}. I understand my
                          electronic signature is legally binding.
                        </span>
                      </label>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
