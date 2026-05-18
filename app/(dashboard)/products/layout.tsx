import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getUserProfile, hasAccountAdminAccess } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function ProductsLayout({
  children,
}: {
  children: ReactNode
}) {
  const profile = await getUserProfile()
  if (!profile) redirect("/login")

  const supabase = await createClient()
  const allowed = await hasAccountAdminAccess(supabase, profile.account_id)
  if (!allowed) redirect("/")

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="font-cal text-3xl font-bold">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a blank from a partner, add your design, and publish. Active
          products show on your shop and via the public API.
        </p>
      </div>
      {children}
    </div>
  )
}
