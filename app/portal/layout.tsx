import type { ReactNode } from "react"
import { requirePortalContext } from "@/lib/portal-auth"
import { PortalShell } from "@/components/portal/portal-shell"

export const dynamic = "force-dynamic"

export default async function PortalLayout({
  children,
}: {
  children: ReactNode
}) {
  const ctx = await requirePortalContext()

  const initials = `${ctx.profile.first_name?.[0] ?? ""}${
    ctx.profile.last_name?.[0] ?? ""
  }`
    .toUpperCase()
    .trim()

  return (
    <PortalShell
      userInitials={initials || ctx.email?.[0]?.toUpperCase() || "U"}
      userEmail={ctx.email}
    >
      {children}
    </PortalShell>
  )
}
