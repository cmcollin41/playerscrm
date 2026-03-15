import { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { MainNav } from "@/components/navigation/main-nav";
import { UserNav } from "@/components/navigation/user-nav";
import Link from "next/link";
import Image from "next/image";
import type { UserRole } from "@/types/schema.types";


export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userRole: UserRole = "general"
  let userInitials = ""
  let userPhoto: string | undefined

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, first_name, last_name, people_id, people(photo)")
      .eq("id", user.id)
      .single()

    if (profile?.role) userRole = profile.role as UserRole

    const first = (profile?.first_name as string) || ""
    const last = (profile?.last_name as string) || ""
    if (first || last) {
      userInitials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
    }

    userPhoto = (profile?.people as any)?.photo || undefined
  }

  return (
    <>
      <div className="sticky top-0 z-50 flex-col bg-gray-50 md:flex">
        <div className="border-b">
          <div className="mx-auto max-w-screen-2xl">
            <div className="flex h-16 items-center px-4">
              <Link href="/">
                <Image src="/logo.svg" width={50} height={50} alt="Bulldog Logo" />
              </Link>
              <MainNav className="mx-6" userRole={userRole} />
              <div className="ml-auto flex items-center space-x-4">
                <UserNav userRole={userRole} userInitials={userInitials} userPhoto={userPhoto} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto my-10 min-h-screen w-full max-w-screen-2xl px-4">
        {children}
      </div>
      <div className="bg-black text-white flex flex-col space-y-6 py-8">
        <h1 className="font-cal text-sm text-center font-mono">©  Provo Basketball Club {new Date().getFullYear()}</h1>
      </div>
    </>
  );
}
