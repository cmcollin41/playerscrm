"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusIcon } from "@heroicons/react/24/outline"
import { formatDistanceToNow } from "date-fns"
import SendEmailSheet from "@/components/modal/send-email-sheet"
import { Mail, Send, CheckCircle2, XCircle, List, Radio, ArrowRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"
import Link from "next/link"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

interface Email {
  id: string
  created_at: string
  sender: string
  subject: string
  content: string
  status: string
  sent_at: string | null
  resend_id: string | null
  recipient: {
    id: string
    first_name: string
    last_name: string
    email: string
    dependent: boolean
  } | null
}

interface Person {
  id: string
  first_name: string
  last_name: string
  email: string
  dependent: boolean
}

interface EmailsClientProps {
  emails: Email[]
  people: Person[]
  account: any
  accountId: string
  listsCount: number
  syncedListsCount: number
  totalListMembers: number
  broadcastsCount: number
  sentBroadcasts: number
  avgOpenRate: number
  teams: any[]
  lists: any[]
  showHeaderButton?: boolean
}

const getStatusBadge = (status: string) => {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", className: string, icon: any }> = {
    sent: {
      variant: "default",
      className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
      icon: Send
    },
    delivered: {
      variant: "outline",
      className: "bg-green-100 text-green-800 hover:bg-green-100",
      icon: CheckCircle2
    },
    failed: {
      variant: "destructive",
      className: "bg-red-100 text-red-800 hover:bg-red-100",
      icon: XCircle
    },
  }

  const statusConfig = config[status] || config.sent
  const Icon = statusConfig.icon

  return (
    <Badge variant={statusConfig.variant} className={statusConfig.className}>
      <Icon className="h-3 w-3 mr-1" />
      {status.toUpperCase()}
    </Badge>
  )
}

// Export the email button as a separate component
export function NewEmailButton({ 
  people, 
  account, 
  teams, 
  lists 
}: { 
  people: Person[], 
  account: any, 
  teams: any[], 
  lists: any[] 
}) {
  const peopleWithEmails = people.filter(person => person.email)
  
  return (
    <SendEmailSheet
      account={account}
      cta={
        <span className="flex items-center">
          <PlusIcon className="h-5 w-5 mr-2" />
          New Email
        </span>
      }
      allowRecipientSelection={true}
      allPeople={peopleWithEmails}
      teams={teams}
      lists={lists}
    />
  )
}

export default function EmailsClient({ 
  emails, 
  people, 
  account, 
  accountId,
  listsCount,
  syncedListsCount,
  totalListMembers,
  broadcastsCount,
  sentBroadcasts,
  avgOpenRate,
  teams,
  lists,
  showHeaderButton = true
}: EmailsClientProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [globalFilter, setGlobalFilter] = useState("")
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})

  const columns = useMemo<ColumnDef<Email>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: "Date",
      },
      {
        accessorKey: "recipient",
        header: "Recipient",
        filterFn: (row, id, value) => {
          const recipient = row.original.recipient
          if (!recipient) return false
          const searchValue = value.toLowerCase()
          const fullName = `${recipient.first_name} ${recipient.last_name}`.toLowerCase()
          return fullName.includes(searchValue) || recipient.email.toLowerCase().includes(searchValue)
        },
      },
      {
        accessorKey: "sender",
        header: "Sender",
      },
      {
        accessorKey: "subject",
        header: "Subject",
        filterFn: (row, id, value) => {
          return row.original.subject?.toLowerCase().includes(value.toLowerCase()) || false
        },
      },
      {
        accessorKey: "content",
        header: "Content",
        filterFn: (row, id, value) => {
          return row.original.content?.toLowerCase().includes(value.toLowerCase()) || false
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        filterFn: (row, id, value) => {
          if (value === "all") return true
          return row.original.status === value
        },
      },
    ],
    []
  )

  // Filter data based on status
  const filteredData = useMemo(() => {
    if (statusFilter === "all") return emails
    return emails.filter(email => email.status === statusFilter)
  }, [emails, statusFilter])

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
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const searchValue = filterValue.toLowerCase()
      const recipient = row.original.recipient
      const recipientName = recipient ? `${recipient.first_name} ${recipient.last_name}`.toLowerCase() : ""
      const recipientEmail = recipient?.email?.toLowerCase() || ""
      const subject = row.original.subject?.toLowerCase() || ""
      const sender = row.original.sender?.toLowerCase() || ""
      const content = row.original.content?.toLowerCase() || ""

      return (
        recipientName.includes(searchValue) ||
        recipientEmail.includes(searchValue) ||
        subject.includes(searchValue) ||
        sender.includes(searchValue) ||
        content.includes(searchValue)
      )
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
  })

  useEffect(() => {
    table.setPageSize(25)
  }, [table])

  // Calculate statistics
  const stats = useMemo(() => {
    const total = emails.length
    const sent = emails.filter(email => email.status === "sent").length
    const failed = emails.filter(email => email.status === "failed").length
    const delivered = emails.filter(email => email.status === "delivered").length
    
    const uniqueRecipients = new Set(emails.map(email => email.recipient?.id).filter(Boolean))
    
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentEmails = emails.filter(email => 
      new Date(email.created_at) > sevenDaysAgo
    ).length

    return {
      total,
      sent,
      failed,
      delivered,
      uniqueRecipients: uniqueRecipients.size,
      recentEmails,
    }
  }, [emails])

  const peopleWithEmails = people.filter(person => person.email)

  return (
    <div className="space-y-6">
      {showHeaderButton && (
        <div className="flex items-center justify-end">
          <SendEmailSheet
            account={account}
            cta={
              <span className="flex items-center">
                <PlusIcon className="h-4 w-4 mr-2" />
                New Email
              </span>
            }
            allowRecipientSelection={true}
            allPeople={peopleWithEmails}
            teams={teams}
            lists={lists}
          />
        </div>
      )}

      {/* Top Statistics - Email Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.sent} sent, {stats.failed} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Recipients</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueRecipients}</div>
            <p className="text-xs text-muted-foreground">People contacted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.sent} of {stats.total} sent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentEmails}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Lists & Broadcasts Quick Access */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Lists Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <List className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Lists</CardTitle>
              </div>
              <Link href="/emails/lists">
                <Button variant="ghost" size="sm">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <CardDescription>Manage segments for targeted communication</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Lists</span>
                <span className="text-2xl font-bold">{listsCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Synced to Resend</span>
                <span className="text-lg font-medium">{syncedListsCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Members</span>
                <span className="text-lg font-medium">{totalListMembers}</span>
              </div>
              <Link href="/emails/lists">
                <Button className="w-full mt-2" variant="outline">
                  Manage Lists
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Broadcasts Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Broadcasts</CardTitle>
              </div>
              <Link href="/emails/broadcasts">
                <Button variant="ghost" size="sm">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <CardDescription>Send newsletters to your segments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Campaigns</span>
                <span className="text-2xl font-bold">{broadcastsCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Sent</span>
                <span className="text-lg font-medium">{sentBroadcasts}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg Open Rate</span>
                <span className="text-lg font-medium text-green-600">{avgOpenRate}%</span>
              </div>
              <Link href="/emails/broadcasts">
                <Button className="w-full mt-2" variant="outline">
                  View Broadcasts
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email History */}
      <Card>
        <CardHeader>
          <CardTitle>Email History ({table.getFilteredRowModel().rows.length})</CardTitle>
          <CardDescription>
            Complete history of all emails sent from your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full space-y-4">
            <div className="flex items-center gap-4">
              <Input
                placeholder="Search by recipient, subject, sender, or content..."
                value={globalFilter ?? ""}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="max-w-sm"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {table.getRowModel().rows?.length ? (
              <div className="divide-y rounded-md border">
                {table.getRowModel().rows.map((row) => {
                  const email = row.original
                  const recipient = email.recipient
                  const plainContent = email.content
                    ? email.content.replace(/<[^>]*>/g, "").substring(0, 140)
                    : ""

                  return (
                    <div
                      key={row.id}
                      className="flex gap-4 px-5 py-4 hover:bg-muted/50 transition-colors"
                    >
                      <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                        <AvatarFallback className="text-xs">
                          {recipient
                            ? getInitials(recipient.first_name, recipient.last_name)
                            : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-2.5">
                        {/* Row 1: Recipient + status/date */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {recipient ? (
                              <span className="text-[15px] font-semibold truncate">
                                {recipient.first_name} {recipient.last_name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Unknown recipient</span>
                            )}
                            {recipient?.dependent && (
                              <Badge variant="outline" className="text-[10px]">
                                Dependent
                              </Badge>
                            )}
                            {recipient?.email && (
                              <span className="text-xs text-muted-foreground/70 truncate hidden sm:inline">
                                {recipient.email}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {getStatusBadge(email.status)}
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(email.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Row 2: Subject */}
                        <p className="text-sm font-medium text-foreground/90 truncate leading-tight">
                          {email.subject || <span className="text-muted-foreground italic">No subject</span>}
                        </p>

                        {/* Row 3: Content preview */}
                        {plainContent && (
                          <p className="text-[13px] text-muted-foreground/70 line-clamp-1 leading-relaxed">
                            {plainContent}
                          </p>
                        )}

                        {/* Row 4: Sender + relative time — visually separated */}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
                          <Mail className="h-3 w-3 text-muted-foreground/50" />
                          <span className="text-[11px] text-muted-foreground/60">
                            {email.sender || "Unknown sender"}
                          </span>
                          <span className="text-muted-foreground/30">·</span>
                          <span className="text-[11px] text-muted-foreground/60">
                            {formatDistanceToNow(new Date(email.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-md border">
                {emails.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12">
                    <Mail className="h-12 w-12 text-muted-foreground/50" />
                    <p className="font-medium">No emails sent yet</p>
                    <p className="text-sm text-muted-foreground">
                      Send your first email to get started
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground">No emails match your filters</p>
                  </div>
                )}
              </div>
            )}

            {/* Pagination Controls */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length
                )}{" "}
                of {table.getFilteredRowModel().rows.length} email(s)
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
                <div className="text-sm text-muted-foreground">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </div>
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
        </CardContent>
      </Card>
    </div>
  )
}
