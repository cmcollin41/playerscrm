import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getUserProfile, hasAccountAdminAccess } from "@/lib/auth"
import { Boxes } from "lucide-react"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function StoreLayout({
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
        <h1 className="font-cal text-3xl font-bold">Store</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sell merchandise and uniforms to your families. Products you publish
          here appear in the parent portal and via the public API.
        </p>
      </div>
      <nav className="flex gap-2 border-b">
        <StoreTab
          href="/store/manage/products"
          icon={<Boxes className="h-4 w-4" />}
        >
          Products
        </StoreTab>
      </nav>
      <div>{children}</div>
    </div>
  )
}

function StoreTab({
  href,
  icon,
  children,
}: {
  href: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
        "hover:text-foreground"
      )}
    >
      {icon}
      {children}
    </Link>
  )
}
