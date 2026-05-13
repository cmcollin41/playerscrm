import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requirePortalContext } from "@/lib/portal-auth"
import { FamilyMemberForm } from "./family-member-form"

export const dynamic = "force-dynamic"

interface PersonRow {
  id: string
  first_name: string | null
  last_name: string | null
  name: string | null
  email: string | null
  phone: string | null
  birthdate: string | null
  grade: string | null
  gender: string | null
  aau_number: string | null
  height: string | null
  weight_lbs: number | null
  grad_year: number | null
  hometown: string | null
  bio: string | null
  maxpreps_url: string | null
  instagram: string | null
  twitter: string | null
  hudl_url: string | null
  dependent: boolean | null
}

export default async function FamilyMemberPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requirePortalContext()

  if (!ctx.accessiblePersonIds.includes(id)) {
    notFound()
  }

  const supabase = await createClient()
  const { data: person } = await supabase
    .from("people")
    .select(
      "id, first_name, last_name, name, email, phone, birthdate, grade, gender, aau_number, height, weight_lbs, grad_year, hometown, bio, maxpreps_url, instagram, twitter, hudl_url, dependent",
    )
    .eq("id", id)
    .maybeSingle<PersonRow>()

  if (!person) notFound()

  const displayName =
    [person.first_name, person.last_name].filter(Boolean).join(" ").trim() ||
    person.email ||
    "Family member"

  return (
    <div className="space-y-6">
      <Link
        href="/portal/family"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to family
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{displayName}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Update contact info and profile details. Fields managed by your
          program (tags, public visibility, account assignment) can only be
          changed by an admin.
        </p>
      </div>
      <FamilyMemberForm person={person} />
    </div>
  )
}
