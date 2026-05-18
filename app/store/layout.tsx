import type { ReactNode } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getTenantAccount } from "@/lib/tenant"
import { getOrganizationLogoPublicUrl } from "@/lib/storage/organization-logo"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function PublicStoreLayout({
  children,
}: {
  children: ReactNode
}) {
  const account = await getTenantAccount()
  if (!account) notFound()

  const supabase = await createClient()
  let orgLogoUrl: string | undefined
  let orgName: string | undefined
  if (account.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, logo")
      .eq("id", account.organization_id)
      .maybeSingle()
    orgName = org?.name ?? undefined
    orgLogoUrl = getOrganizationLogoPublicUrl(
      supabase,
      org?.logo ?? undefined,
      org?.id ?? account.organization_id,
    )
  }

  const displayName = account.name ?? orgName ?? "Team store"

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b">
        <div className="mx-auto flex max-w-screen-lg items-center justify-between px-4 py-4">
          <Link href="/store" className="flex items-center gap-3">
            {orgLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={orgLogoUrl}
                alt={displayName}
                className="h-8 w-8 rounded object-cover"
              />
            ) : null}
            <div>
              <p className="text-sm font-semibold leading-tight">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground">Team store</p>
            </div>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-screen-lg px-4 py-8">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Powered by Athletes App
      </footer>
    </div>
  )
}
