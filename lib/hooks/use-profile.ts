import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profiles } from "@/types/schema.types"

export default function useProfile() {
  const [profile, setProfile] = useState<Profiles | null>(null)
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

      if (!error && data) setProfile(data as Profiles)
      setLoading(false)
    }

    fetchProfile()
  }, [])

  return {
    profile,
    loading,
    isAdmin: profile?.role === "admin",
    role: profile?.role ?? "general",
  }
}
