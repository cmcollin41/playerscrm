import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requirePortalContext } from "@/lib/portal-auth"

export const dynamic = "force-dynamic"

interface FamilyMember {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  photo: string | null
  grade: string | null
  grad_year: number | null
  dependent: boolean | null
}

export default async function PortalFamilyPage() {
  const ctx = await requirePortalContext()
  const supabase = await createClient()

  const { data: people } = await supabase
    .from("people")
    .select(
      "id, first_name, last_name, email, phone, photo, grade, grad_year, dependent",
    )
    .in("id", ctx.accessiblePersonIds.length ? ctx.accessiblePersonIds : [""])
    .order("dependent", { ascending: true, nullsFirst: true })
    .order("first_name", { ascending: true })
    .returns<FamilyMember[]>()

  const members = people ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Family</h1>
        <p className="mt-1 text-sm text-gray-600">
          You and the people you&apos;re connected to. Tap a name to view or
          update their details.
        </p>
      </div>

      {members.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {members.map((member) => (
            <li key={member.id}>
              <Link
                href={`/portal/family/${member.id}`}
                className="flex items-center gap-4 p-4 transition hover:bg-gray-50"
              >
                <Avatar member={member} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {displayName(member)}
                    {member.id === ctx.selfPersonId && (
                      <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        You
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {[
                      member.dependent ? "Dependent" : "Guardian",
                      member.grade,
                      member.grad_year ? `Class of ${member.grad_year}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function displayName(p: FamilyMember): string {
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim()
  return name || p.email || "Unnamed"
}

function Avatar({ member }: { member: FamilyMember }) {
  if (member.photo) {
    return (
      <Image
        src={member.photo}
        width={44}
        height={44}
        alt=""
        className="h-11 w-11 rounded-full object-cover"
      />
    )
  }
  const initials = `${member.first_name?.[0] ?? ""}${member.last_name?.[0] ?? ""}`
    .toUpperCase()
    .trim()
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
      {initials || "?"}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
      <p className="text-sm text-gray-500">
        Nothing here yet. Once your program admin links your email to a person
        on file, you and your dependents will show up here.
      </p>
    </div>
  )
}
