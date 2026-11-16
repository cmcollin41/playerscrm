import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profiles } from "@/types/schema.types"

/**
 * The signed-in user's profile, plus whether they are an admin of the
 * account they are currently working in. Admin comes from account
 * membership (has_account_role), never from the legacy role column.
 */
export default function useProfile() {
  const [profile, setProfile] = useState<Profiles | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (!error && data) {
        setProfile(data as Profiles)

        const activeAccountId = data.current_account_id || data.account_id
        if (activeAccountId) {
          const { data: allowed } = await supabase.rpc("has_account_role", {
            p_account_id: activeAccountId,
            p_min_role: "admin",
          })
          setIsAdmin(allowed === true)
        }
      }

      setLoading(false)
    }

    fetchProfile()
  }, [])

  return { profile, loading, isAdmin }
}
