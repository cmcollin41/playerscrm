import Link from "next/link"

import { cn } from "@/lib/utils"
import type { UserRole } from "@/types/schema.types"

interface MainNavProps extends React.HTMLAttributes<HTMLElement> {
  userRole?: UserRole
}

export function MainNav({ className, userRole = "general", ...props }: MainNavProps) {
  const isAdmin = userRole === "admin"

  return (
    <nav
      className={cn(
        "hidden items-center space-x-4 md:flex lg:space-x-6",
        className,
      )}
      {...props}
    >
      <Link
        href="/"
        className="text-sm font-medium transition-colors hover:text-zinc-900"
      >
        Overview
      </Link>
      <Link
        href="/people"
        className="text-muted-foreground text-sm font-medium transition-colors hover:text-zinc-900"
      >
        People
      </Link>
      <Link
        href="/teams"
        className="text-muted-foreground text-sm font-medium transition-colors hover:text-zinc-900"
      >
        Teams
      </Link>
      {isAdmin && (
        <Link
          href="/invoices"
          className="text-muted-foreground text-sm font-medium transition-colors hover:text-zinc-900"
        >
          Invoices
        </Link>
      )}
      {isAdmin && (
        <Link
          href="/emails"
          className="text-muted-foreground text-sm font-medium transition-colors hover:text-zinc-900"
        >
          Emails
        </Link>
      )}
      {isAdmin && (
        <Link
          href="/settings"
          className="text-muted-foreground text-sm font-medium transition-colors hover:text-zinc-900"
        >
          Settings
        </Link>
      )}
    </nav>
  )
}
