import type { LucideIcon } from "lucide-react"
import { Crown, Shield, ShieldCheck, User } from "lucide-react"

export const ACCOUNT_ROLES = ["owner", "admin", "manager", "member"] as const
export type AccountRole = (typeof ACCOUNT_ROLES)[number]

export function isValidAccountRole(value: string): value is AccountRole {
  return (ACCOUNT_ROLES as readonly string[]).includes(value)
}

/** Map legacy profiles.role values to account_members roles. */
export function parseAccountRole(value: string | null | undefined): AccountRole {
  const v = (value || "member").toLowerCase()
  if (isValidAccountRole(v)) return v
  if (v === "general") return "member"
  return "member"
}

/** Ordered from most to least privileged — used for "don't downgrade" checks. */
const ROLE_RANK: Record<AccountRole, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  member: 1,
}

export function roleRank(role: AccountRole): number {
  return ROLE_RANK[role] ?? 0
}

export function isHigherOrEqualRole(a: AccountRole, b: AccountRole): boolean {
  return roleRank(a) >= roleRank(b)
}

export interface RoleDisplayConfig {
  label: string
  icon: LucideIcon
  color: string
  description: string
}

export const ROLE_CONFIG: Record<AccountRole, RoleDisplayConfig> = {
  owner: {
    label: "Owner",
    icon: Crown,
    color: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    description: "Full control over the account",
  },
  admin: {
    label: "Admin",
    icon: Shield,
    color: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    description: "Can manage settings, users, and data",
  },
  manager: {
    label: "Manager",
    icon: ShieldCheck,
    color: "bg-green-100 text-green-800 hover:bg-green-100",
    description: "Can manage people, teams, and emails",
  },
  member: {
    label: "Member",
    icon: User,
    color: "bg-gray-100 text-gray-700 hover:bg-gray-100",
    description: "Read-only access",
  },
}
