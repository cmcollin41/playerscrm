import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MainNav } from "@/components/navigation/main-nav";
import { UserNav } from "@/components/navigation/user-nav";
import { AccountSwitcher } from "@/components/navigation/account-switcher";
import Link from "next/link";
import type { UserRole } from "@/types/schema.types";
import { getOrganizationLogoPublicUrl } from "@/lib/storage/organization-logo";
import { DashboardFooterOrgLogo, DashboardHeaderLogo } from "@/components/navigation/dashboard-org-logo";
import { DashboardAccessDenied } from "./access-denied";


export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login")

  // Gate the dashboard to staff only. Registrants who signed up via magic
  // link have a session but no membership; render an explicit no-access
  // screen instead of the dashboard chrome.
  const [{ count: accountMemberCount }, { count: orgMemberCount }] = await Promise.all([
    supabase
      .from("account_members")
      .select("account_id", { count: "exact", head: true })
      .eq("profile_id", user.id),
    supabase
      .from("organization_members")
      .select("organization_id", { count: "exact", head: true })
      .eq("profile_id", user.id),
  ])

  const hasStaffAccess = (accountMemberCount ?? 0) > 0 || (orgMemberCount ?? 0) > 0
  if (!hasStaffAccess) {
    return <DashboardAccessDenied email={user.email ?? null} />
  }

  let userRole: UserRole = "general"
  let userInitials = ""
  let userPhoto: string | undefined
  let currentAccountId: string | undefined
  let currentAccountName: string | undefined
  let orgName: string | undefined
  let orgLogoUrl: string | undefined

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, first_name, last_name, people_id, people(photo), current_account_id, account_id")
      .eq("id", user.id)
      .single()

    if (profile?.role) userRole = profile.role as UserRole
    currentAccountId = profile?.current_account_id || profile?.account_id || undefined

    const first = (profile?.first_name as string) || ""
    const last = (profile?.last_name as string) || ""
    if (first || last) {
      userInitials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
    }

    userPhoto = (profile?.people as any)?.photo || undefined

    // Fetch account then organization explicitly (avoids unreliable embedded selects for logo).
    if (currentAccountId) {
      const { data: account } = await supabase
        .from("accounts")
        .select("name, organization_id")
        .eq("id", currentAccountId)
        .single()

      currentAccountName = account?.name || undefined

      if (account?.organization_id) {
        const { data: org } = await supabase
          .from("organizations")
          .select("id, name, logo")
          .eq("id", account.organization_id)
          .maybeSingle()

        orgName = org?.name || undefined
        const orgId = org?.id ?? account.organization_id
        orgLogoUrl = getOrganizationLogoPublicUrl(supabase, org?.logo ?? undefined, orgId)
      }
    }
  }

  return (
    <>
      <div className="sticky top-0 z-50 flex-col bg-gray-50 md:flex">
        {orgName && (
          <div className="border-b border-gray-200 bg-gray-900 px-4 py-1">
            <div className="mx-auto max-w-screen-2xl">
              <p className="text-center text-xs font-medium tracking-wide text-gray-300">
                {orgName}
              </p>
            </div>
          </div>
        )}
        <div className="border-b">
          <div className="mx-auto max-w-screen-2xl">
            <div className="flex h-16 items-center px-4">
              <Link href="/" className="flex shrink-0 items-center">
                <DashboardHeaderLogo orgLogoUrl={orgLogoUrl} orgName={orgName} />
              </Link>
              <MainNav className="mx-6" userRole={userRole} />
              <div className="ml-auto flex items-center space-x-3">
                <AccountSwitcher currentAccountId={currentAccountId} currentAccountName={currentAccountName} />
                <UserNav userRole={userRole} userInitials={userInitials} userPhoto={userPhoto} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto my-10 min-h-screen w-full max-w-screen-2xl px-4">
        {children}
      </div>
      <div className="flex flex-col items-center space-y-4 bg-black py-8 text-white">
        <DashboardFooterOrgLogo orgLogoUrl={orgLogoUrl} />
        <p className="font-cal text-center text-sm font-mono">
          © {new Date().getFullYear()} Athletes App
        </p>
      </div>
    </>
  );
}
