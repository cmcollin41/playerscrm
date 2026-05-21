import { createClient } from "@/lib/supabase/server"
import { CheckoutForm, type InitialUser } from "./checkout-form"

export const dynamic = "force-dynamic"

async function loadInitialUser(): Promise<InitialUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Enrich with profile + linked person (for phone). Either may be missing
  // for newly created users — fall back to auth.user.email and an empty name.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, people(name, phone)")
    .eq("id", user.id)
    .maybeSingle()

  const peopleRaw = (profile as any)?.people
  const person = Array.isArray(peopleRaw) ? peopleRaw[0] : peopleRaw

  const profileEmail = profile?.email ?? user.email ?? ""
  const fullName =
    [profile?.first_name, profile?.last_name]
      .filter((s): s is string => Boolean(s && s.trim()))
      .join(" ")
      .trim() ||
    person?.name ||
    ""

  return {
    profileId: user.id,
    email: profileEmail,
    name: fullName,
    phone: person?.phone ?? "",
  }
}

export default async function CheckoutPage() {
  const initialUser = await loadInitialUser()
  return <CheckoutForm initialUser={initialUser} />
}
