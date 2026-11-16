"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InviteUserDialog } from "@/components/modal/invite-user-dialog"

import { getAccountWithDomain } from "@/lib/fetchers/client"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  DollarSign,
  KeyRound,
  LogOut,
  Settings,
  Shield,
  UserPlus,
  Users,
} from "lucide-react"
import type { UserRole } from "@/types/schema.types"

interface UserNavProps {
  userRole?: UserRole
  userInitials?: string
  userPhoto?: string
}

export function UserNav({ userRole = "general", userInitials, userPhoto }: UserNavProps) {
  const params = useParams()
  const [account, setAccount] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const isAdmin = userRole === "admin"

  useEffect(() => {
    const fetchAccount = async () => {
      const acc = await getAccountWithDomain(
        (params.domain as string) || (params.subdomain as string),
      )
      const {
        data: { user: u },
      } = await supabase.auth.getUser()
      setAccount(acc)
      setUser(u)
    }

    fetchAccount()
  }, [])

  const logout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) console.log("Error logging out: ", error.message)
    if (!error) {
      router.refresh()
    }
  }


  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="relative h-8 w-8 rounded-full border border-gray-300 p-0">
            <Avatar className="h-8 w-8">
              {userPhoto && <AvatarImage src={userPhoto} alt="Profile" />}
              <AvatarFallback className="bg-gray-100 text-[11px] font-medium text-gray-500">
                {userInitials || "?"}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="z-50 w-56 bg-white"
          align="end"
          forceMount
        >
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{account?.name}</p>
              <p className="text-xs leading-none text-zinc-700">{user?.email}</p>
              {isAdmin && (
                <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
                  <Shield className="h-2.5 w-2.5" />
                  Admin
                </span>
              )}
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex w-full cursor-pointer items-center">
                <Settings className="mr-2 h-3.5 w-3.5" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/settings/profile"
                className="flex w-full cursor-pointer items-center"
              >
                <KeyRound className="mr-2 h-3.5 w-3.5" />
                Your profile
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Admin
              </DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link
                    href="/settings/users"
                    className="flex w-full cursor-pointer items-center"
                  >
                    <Users className="mr-2 h-3.5 w-3.5" />
                    Manage Users
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    setInviteOpen(true)
                  }}
                  className="cursor-pointer"
                >
                  <UserPlus className="mr-2 h-3.5 w-3.5" />
                  Invite User
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/settings/fees"
                    className="flex w-full cursor-pointer items-center"
                  >
                    <DollarSign className="mr-2 h-3.5 w-3.5" />
                    Manage Fees
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="cursor-pointer hover:bg-gray-100"
            onSelect={() => logout()}
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        accountName={account?.name}
      />
    </>
  )
}

