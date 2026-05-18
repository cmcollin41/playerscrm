import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Boxes, Truck } from "lucide-react"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AdminStoreLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    redirect("/")
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Platform admin
        </p>
        <h1 className="font-cal text-3xl font-bold">Store catalog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the platform-wide list of fulfillment partners and product
          templates. Orgs clone templates into their own products.
        </p>
      </div>
      <nav className="flex gap-2 border-b">
        <AdminTab href="/admin/store/templates" icon={<Boxes className="h-4 w-4" />}>
          Templates
        </AdminTab>
        <AdminTab href="/admin/store/partners" icon={<Truck className="h-4 w-4" />}>
          Partners
        </AdminTab>
      </nav>
      <div>{children}</div>
    </div>
  )
}

function AdminTab({
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
