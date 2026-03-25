"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

import {
  MixerHorizontalIcon,
} from "@radix-ui/react-icons"

import {
  ArrowLeft,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react"

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import LoadingDots from "@/components/icons/loading-dots"
import { Skeleton } from "@/components/ui/skeleton"
import { getInitials } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ACCOUNT_ROLES, ROLE_CONFIG, type AccountRole } from "@/lib/roles"

interface AccountUser {
  id: string
  membership_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: AccountRole
  created_at: string
}

export default function UsersPage() {
  const supabase = createClient()
  const router = useRouter()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [accountName, setAccountName] = useState("")
  const [accountUsers, setAccountUsers] = useState<AccountUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteFirstName, setInviteFirstName] = useState("")
  const [inviteLastName, setInviteLastName] = useState("")
  const [inviteRole, setInviteRole] = useState<AccountRole>("member")

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace("/login")
        return
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("current_account_id, account_id")
        .eq("id", user.id)
        .single()

      const activeAccountId =
        profile?.current_account_id ?? profile?.account_id ?? null

      if (error || !activeAccountId) {
        router.replace("/")
        return
      }

      const { data: rpcAccess, error: accessError } = await supabase.rpc(
        "has_account_role",
        { p_account_id: activeAccountId, p_min_role: "admin" },
      )

      let canManage = rpcAccess === true
      if (!canManage) {
        const { data: membership } = await supabase
          .from("account_members")
          .select("role")
          .eq("account_id", activeAccountId)
          .eq("profile_id", user.id)
          .maybeSingle()

        canManage =
          membership?.role === "admin" || membership?.role === "owner"
      }

      if (accessError) {
        console.warn("has_account_role rpc:", accessError.message)
      }

      if (!canManage) {
        router.replace("/")
        return
      }

      const { data: accountRow } = await supabase
        .from("accounts")
        .select("name")
        .eq("id", activeAccountId)
        .single()

      setCurrentUserId(user.id)
      setIsAdmin(true)
      setAccountName(accountRow?.name || "")
    }

    checkAuth()
  }, [])

  useEffect(() => {
    if (!isAdmin) return

    const fetchUsers = async () => {
      setUsersLoading(true)
      try {
        const res = await fetch("/api/admin/users", {
          credentials: "include",
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : `Failed to load users (${res.status})`
          console.error("GET /api/admin/users:", res.status, data)
          throw new Error(msg)
        }
        setAccountUsers(data.users || [])
      } catch (error) {
        console.error("Error fetching users:", error)
        toast.error(
          error instanceof Error ? error.message : "Failed to load users",
        )
      } finally {
        setUsersLoading(false)
      }
    }

    fetchUsers()
  }, [isAdmin])

  const handleRoleChange = async (userId: string, newRole: AccountRole) => {
    setUpdatingUserId(userId)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update role")
      }

      setAccountUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      )
      toast.success(`Role updated to ${ROLE_CONFIG[newRole].label}`)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setUpdatingUserId(null)
    }
  }

  const resetInviteForm = () => {
    setInviteEmail("")
    setInviteFirstName("")
    setInviteLastName("")
    setInviteRole("member")
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
        credentials: "include",
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

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingDots color="#808080" />
      </div>
    )
  }

  const roleCounts = ACCOUNT_ROLES.reduce(
    (acc, role) => {
      acc[role] = accountUsers.filter((u) => u.role === role).length
      return acc
    },
    {} as Record<AccountRole, number>,
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/settings/account"
          className="text-muted-foreground inline-flex w-fit items-center gap-1 text-sm hover:text-gray-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Workspace settings
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Users & Roles</h1>
            <p className="text-muted-foreground">
              Manage who has access to {accountName || "your account"} and what they can do
            </p>
          </div>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {ACCOUNT_ROLES.map((role) => {
          const config = ROLE_CONFIG[role]
          const Icon = config.icon
          return (
            <Card key={role}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{config.label}s</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{roleCounts[role]}</div>
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users ({accountUsers.length})</CardTitle>
          <CardDescription>
            Members of this account and their roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="ml-auto h-10 w-24" />
              </div>
              <div className="space-y-1">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            </div>
          ) : (
            <UsersTable
              data={accountUsers}
              currentUserId={currentUserId}
              updatingUserId={updatingUserId}
              onRoleChange={handleRoleChange}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation to join {accountName || "your account"}.
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
                onValueChange={(val) => setInviteRole(val as AccountRole)}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_CONFIG[role].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {ROLE_CONFIG[inviteRole].description}
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
              {inviting ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UsersTable({
  data,
  currentUserId,
  updatingUserId,
  onRoleChange,
}: {
  data: AccountUser[]
  currentUserId: string | null
  updatingUserId: string | null
  onRoleChange: (userId: string, newRole: AccountRole) => void
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [roleFilter, setRoleFilter] = useState<string>("all")

  const filteredData =
    roleFilter === "all"
      ? data
      : data.filter((u) => u.role === roleFilter)

  const columns: ColumnDef<AccountUser>[] = [
    {
      accessorKey: "name",
      header: "Name",
      accessorFn: (row) =>
        [row.first_name, row.last_name].filter(Boolean).join(" ") || "—",
      cell: ({ row }) => {
        const firstName = row.original.first_name || ""
        const lastName = row.original.last_name || ""
        const name = [firstName, lastName].filter(Boolean).join(" ") || "—"
        const isSelf = row.original.id === currentUserId
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {firstName && lastName
                  ? getInitials(firstName, lastName)
                  : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2">
              <span className="font-medium">{name}</span>
              {isSelf && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  You
                </Badge>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.email || "—"}
        </span>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const role = row.original.role as AccountRole
        const config = ROLE_CONFIG[role] || ROLE_CONFIG.member
        const Icon = config.icon
        return (
          <Badge variant="secondary" className={config.color}>
            <Icon className="mr-1 h-3 w-3" />
            {config.label}
          </Badge>
        )
      },
    },
    {
      accessorKey: "created_at",
      header: "Joined",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {new Date(row.original.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Role</div>,
      cell: ({ row }) => {
        const isSelf = row.original.id === currentUserId
        const isUpdating = updatingUserId === row.original.id

        if (isSelf) return null

        return (
          <div className="text-right">
            <Select
              value={row.original.role}
              onValueChange={(val) => onRoleChange(row.original.id, val as AccountRole)}
              disabled={isUpdating}
            >
              <SelectTrigger className="ml-auto w-[130px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_CONFIG[role].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: filteredData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  })

  useEffect(() => {
    table.setPageSize(30)
  }, [])

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search by name..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ACCOUNT_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_CONFIG[role].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="ml-auto flex items-center justify-between"
            >
              <MixerHorizontalIcon className="mr-2 h-4 w-4" /> View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) =>
                    column.toggleVisibility(!!value)
                  }
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="transition-colors hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <UsersIcon className="h-12 w-12 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No users found</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} user(s)
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
