"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

interface SaveResult {
  success: boolean
  error?: string
}

// Mirrors the column whitelist enforced by the people UPDATE trigger from
// PR 2. Keep these in sync.
const EDITABLE_TEXT_FIELDS = [
  "first_name",
  "last_name",
  "name",
  "email",
  "phone",
  "birthdate",
  "grade",
  "gender",
  "aau_number",
  "height",
  "hometown",
  "bio",
  "maxpreps_url",
  "instagram",
  "twitter",
  "hudl_url",
] as const

const EDITABLE_NUMBER_FIELDS = ["weight_lbs", "grad_year"] as const

type PersonPatch = Record<string, string | number | null>

function trimmedOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function intOrNull(value: FormDataEntryValue | null): number | null {
  const trimmed = trimmedOrNull(value)
  if (trimmed === null) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export async function updateFamilyMember(
  personId: string,
  formData: FormData,
): Promise<SaveResult> {
  if (!personId) {
    return { success: false, error: "Missing person id." }
  }

  const supabase = await createClient()
  const patch: PersonPatch = {}

  for (const field of EDITABLE_TEXT_FIELDS) {
    patch[field] = trimmedOrNull(formData.get(field))
  }
  for (const field of EDITABLE_NUMBER_FIELDS) {
    patch[field] = intOrNull(formData.get(field))
  }

  const { error } = await supabase
    .from("people")
    .update(patch)
    .eq("id", personId)

  if (error) {
    console.error("updateFamilyMember:", error.message)
    return {
      success: false,
      error: error.message.startsWith("people.")
        ? "One of the fields can only be edited by your program admin."
        : "Could not save changes.",
    }
  }

  revalidatePath(`/portal/family/${personId}`)
  revalidatePath("/portal/family")
  return { success: true }
}
