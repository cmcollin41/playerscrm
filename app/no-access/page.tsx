import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardAccessDenied } from "../(dashboard)/access-denied"

export const metadata = {
  title: "No access · Athletes App",
}

export default async function NoAccessPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return <DashboardAccessDenied email={user.email ?? null} />
}
