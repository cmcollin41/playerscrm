import type { ReactNode } from "react"
import { requirePortalContext } from "@/lib/portal-auth"
import { getTenantAccount } from "@/lib/tenant"
import { PortalShell } from "@/components/portal/portal-shell"
import { AppFooter } from "@/components/navigation/app-footer"

export const dynamic = "force-dynamic"

export default async function PortalLayout({
  children,
}: {
  children: ReactNode
}) {
  const ctx = await requirePortalContext()
  const tenant = await getTenantAccount()

  const initials = `${ctx.profile.first_name?.[0] ?? ""}${
    ctx.profile.last_name?.[0] ?? ""
  }`
    .toUpperCase()
    .trim()

  return (
    <>
      <PortalShell
        userInitials={initials || ctx.email?.[0]?.toUpperCase() || "U"}
        userEmail={ctx.email}
      >
        {children}
      </PortalShell>
      <AppFooter
        accountLogoUrl={tenant?.logo}
        accountName={tenant?.name}
        links={[
          { href: "/portal/welcome", label: "Portal home" },
          { href: "/portal/events", label: "Events" },
          { href: "/portal/teams", label: "Teams" },
          { href: "/portal/invoices", label: "Invoices" },
        ]}
      />
    </>
  )
}
