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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { getAccountWithDomain } from "@/lib/fetchers/client"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  DollarSign,
  LogOut,
  Settings,
  Shield,
  UserPlus,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import type { UserRole } from "@/types/schema.types"
import LoadingDots from "@/components/icons/loading-dots"

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
  const [inviting, setInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteFirstName, setInviteFirstName] = useState("")
  const [inviteLastName, setInviteLastName] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("general")
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

  const resetInviteForm = () => {
    setInviteEmail("")
    setInviteFirstName("")
    setInviteLastName("")
    setInviteRole("general")
  }

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error("Email is required")
      return
    }

    setInviting(true)
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          firstName: inviteFirstName,
          lastName: inviteLastName,
          role: inviteRole,
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to send invite")

      if (data.emailSent) {
        toast.success(`Invitation sent to ${inviteEmail}`)
      } else {
        toast.success("Invite link generated (no sender configured to email it)")
      }

      resetInviteForm()
      setInviteOpen(false)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setInviting(false)
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

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation to join {account?.name || "your organization"}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="invite-first-name">First Name</Label>
                <Input
                  id="invite-first-name"
                  placeholder="Jane"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-last-name">Last Name</Label>
                <Input
                  id="invite-last-name"
                  placeholder="Doe"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="jane@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(val) => setInviteRole(val as UserRole)}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Admins can manage users, fees, emails, and invoices.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetInviteForm()
                setInviteOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
              {inviting ? <LoadingDots color="#fff" /> : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

