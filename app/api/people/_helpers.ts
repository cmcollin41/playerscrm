import { createClient as createAdminClient } from "@/lib/supabase/admin"

export interface RelationshipInput {
  id: string
  name: string
  primary?: boolean
}

export interface PersonInput {
  first_name: string
  last_name: string
  name: string
  email?: string | null
  phone?: string | null
  birthdate?: string | null
  grade?: string | null
  tags?: string[]
  dependent?: boolean
  photo?: string | null
  is_public?: boolean
  bio?: string | null
  maxpreps_url?: string | null
  instagram?: string | null
  twitter?: string | null
  hudl_url?: string | null
  slug?: string | null
}

export function personUpdate(p: PersonInput) {
  return {
    first_name: p.first_name,
    last_name: p.last_name,
    name: p.name,
    email: p.email ?? null,
    phone: p.phone ?? null,
    birthdate: p.birthdate ?? null,
    grade: p.grade ?? null,
    tags: p.tags ?? [],
    dependent: p.dependent ?? false,
    photo: p.photo ?? null,
    is_public: p.is_public ?? false,
    bio: p.bio ?? null,
    maxpreps_url: p.maxpreps_url ?? null,
    instagram: p.instagram ?? null,
    twitter: p.twitter ?? null,
    hudl_url: p.hudl_url ?? null,
    slug: p.slug ?? null,
  }
}

export async function syncRelationships(
  admin: ReturnType<typeof createAdminClient>,
  accountId: string,
  childId: string,
  rels: RelationshipInput[],
) {
  await admin.from("relationships").delete().eq("relation_id", childId)
  if (rels.length === 0) return

  const parentIds = rels.map((r) => r.id)
  const { data: parentsInAcct } = await admin
    .from("account_people")
    .select("person_id")
    .eq("account_id", accountId)
    .in("person_id", parentIds)
  const validIds = new Set((parentsInAcct ?? []).map((r) => r.person_id))
  const rows = rels
    .filter((r) => validIds.has(r.id))
    .map((r) => ({
      person_id: r.id,
      relation_id: childId,
      name: r.name,
      primary: r.primary ?? false,
    }))
  if (rows.length > 0) {
    await admin.from("relationships").insert(rows)
  }
}
