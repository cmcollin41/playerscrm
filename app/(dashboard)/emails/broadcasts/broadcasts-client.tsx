"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import RichTextEditor from "@/components/emails/rich-text-editor"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline"
import { formatDistanceToNow } from "date-fns"
import { 
  Mail, 
  Send, 
  ArrowUpDown, 
  Loader2, 
  FileText, 
  Users,
  TrendingUp,
  Clock
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
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface Broadcast {
  id: string
  created_at: string
  updated_at: string
  name: string
  subject: string
  content: string
  sender: string
  status: string
  scheduled_at: string | null
  sent_at: string | null
  total_recipients: number
  total_sent: number
  total_delivered: number
  total_opened: number
  total_clicked: number
  list: {
    id: string
    name: string
    list_people: Array<{ count: number }>
  } | null
}

interface List {
  id: string
  name: string
  resend_segment_id: string | null
  list_people: Array<{ count: number }>
}

interface Sender {
  id: string
  name: string
  email: string
}

interface BroadcastsClientProps {
  broadcasts: Broadcast[]
  lists: List[]
  senders: Sender[]
  account: any
  accountId: string
}

const getStatusBadge = (status: string) => {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
    draft: {
      variant: "secondary",
      className: "bg-gray-100 text-gray-800 hover:bg-gray-100",
    },
    scheduled: {
      variant: "default",
      className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    },
    sending: {
      variant: "default",
      className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    },
    sent: {
      variant: "outline",
      className: "bg-green-100 text-green-800 hover:bg-green-100",
    },
    failed: {
      variant: "destructive",
      className: "bg-red-100 text-red-800 hover:bg-red-100",
    },
  }

  const statusConfig = config[status] || config.draft

  return (
    <Badge variant={statusConfig.variant} className={statusConfig.className}>
      {status.toUpperCase()}
    </Badge>
  )
}

export default function BroadcastsClient({ broadcasts, lists, senders, account, accountId }: BroadcastsClientProps) {
  const router = useRouter()
  const [globalFilter, setGlobalFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})

  // Create broadcast modal state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [broadcastName, setBroadcastName] = useState("")
  const [broadcastSubject, setBroadcastSubject] = useState("")
  const [broadcastContent, setBroadcastContent] = useState("")
  const [selectedListId, setSelectedListId] = useState("")
  const [selectedSender, setSelectedSender] = useState("")
  const [sendNow, setSendNow] = useState(false)

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateLoading(true)

    try {
      const response = await fetch("/api/broadcasts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          list_id: selectedListId,
          name: broadcastName,
          subject: broadcastSubject,
          content: broadcastContent,
          sender: selectedSender,
          sendNow,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create broadcast")
      }

      toast.success(sendNow ? "Broadcast sent successfully!" : "Broadcast created as draft")
      setCreateModalOpen(false)
      setBroadcastName("")
      setBroadcastSubject("")
      setBroadcastContent("")
      setSelectedListId("")
      setSelectedSender("")
      setSendNow(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || "Failed to create broadcast")
    } finally {
      setCreateLoading(false)
    }
  }

  // Filter data based on status
  const filteredData = useMemo(() => {
    if (statusFilter === "all") return broadcasts
    return broadcasts.filter((broadcast) => broadcast.status === statusFilter)
  }, [broadcasts, statusFilter])

  // Define columns
  const columns = useMemo<ColumnDef<Broadcast>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="hover:bg-transparent p-0"
            >
              Broadcast
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-sm text-muted-foreground">{row.original.subject}</div>
          </div>
        ),
      },
      {
        accessorKey: "list",
        header: "List",
        cell: ({ row }) => {
          const list = row.original.list
          return list ? (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{list.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
      },
      {
        accessorKey: "recipients",
        header: "Recipients",
        cell: ({ row }) => (
          <div className="font-medium">{row.original.total_recipients || 0}</div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => getStatusBadge(row.original.status),
      },
      {
        accessorKey: "stats",
        header: "Performance",
        cell: ({ row }) => {
          const { total_sent, total_delivered, total_opened } = row.original
          if (row.original.status !== "sent" || !total_sent) {
            return <span className="text-muted-foreground text-sm">—</span>
          }
          const openRate = total_sent > 0 ? Math.round((total_opened / total_sent) * 100) : 0
          return (
            <div className="text-sm">
              <div>Sent: {total_sent}</div>
              <div className="text-muted-foreground">Open rate: {openRate}%</div>
            </div>
          )
        },
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ row }) => (
          <div className="text-sm">
            {new Date(row.original.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(row.original.created_at), { addSuffix: true })}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "sent_at",
        header: "Sent",
        cell: ({ row }) => {
          const sentAt = row.original.sent_at
          return sentAt ? (
            <div className="text-sm">
              {new Date(sentAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )
        },
      },
    ],
    []
  )

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
      return (
        row.original.name.toLowerCase().includes(searchValue) ||
        row.original.subject.toLowerCase().includes(searchValue) ||
        row.original.list?.name.toLowerCase().includes(searchValue) ||
        false
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
    const total = broadcasts.length
    const sent = broadcasts.filter((b) => b.status === "sent").length
    const drafts = broadcasts.filter((b) => b.status === "draft").length
    const totalRecipients = broadcasts.reduce((acc, b) => acc + (b.total_sent || 0), 0)
    const totalOpened = broadcasts.reduce((acc, b) => acc + (b.total_opened || 0), 0)
    const avgOpenRate = totalRecipients > 0 ? Math.round((totalOpened / totalRecipients) * 100) : 0

    return {
      total,
      sent,
      drafts,
      totalRecipients,
      avgOpenRate,
    }
  }, [broadcasts])

  // Get synced lists for dropdown
  const syncedLists = lists.filter((list) => list.resend_segment_id)

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/emails/lists">
            <Users className="h-4 w-4 mr-2" />
            Lists
          </Link>
        </Button>
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogTrigger asChild>
            <Button disabled={syncedLists.length === 0}>
              <PlusIcon className="h-4 w-4 mr-2" />
              New Broadcast
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] h-[85vh] flex flex-col p-0 gap-0">
            <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
              <DialogTitle>Create New Broadcast</DialogTitle>
              <DialogDescription>
                Compose and send a newsletter to one of your lists
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateBroadcast} className="flex flex-col flex-1 min-h-0">
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-4 px-6 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="list">Select List</Label>
                    <Select value={selectedListId} onValueChange={setSelectedListId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a list to send to" />
                      </SelectTrigger>
                      <SelectContent>
                        {syncedLists.map((list) => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name} ({list.list_people[0]?.count || 0} members)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {syncedLists.length === 0 && (
                      <p className="text-sm text-red-600">
                        No synced lists available. Please sync a list first.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sender">From</Label>
                    <Select value={selectedSender} onValueChange={setSelectedSender} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a sender" />
                      </SelectTrigger>
                      <SelectContent>
                        {senders.map((s) => (
                          <SelectItem key={s.id} value={`${s.name} <${s.email}>`}>
                            {s.name} &lt;{s.email}&gt;
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {senders.length === 0 && (
                      <p className="text-sm text-red-600">
                        No senders configured. Add a verified sender in Settings first.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Broadcast Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Weekly Update - Nov 5"
                      value={broadcastName}
                      onChange={(e) => setBroadcastName(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Internal name for tracking (not shown to recipients)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Email Subject</Label>
                    <Input
                      id="subject"
                      placeholder="e.g., Important Updates from Coach"
                      value={broadcastSubject}
                      onChange={(e) => setBroadcastSubject(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email Content</Label>
                    <RichTextEditor
                      content={broadcastContent}
                      onChange={setBroadcastContent}
                      placeholder="Write your email here..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Use the toolbar to format text, add images, and insert links.
                    </p>
                  </div>
                </div>
              </ScrollArea>
              <div className="shrink-0 flex items-center justify-between border-t px-6 py-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="sendNow"
                    checked={sendNow}
                    onCheckedChange={setSendNow}
                  />
                  <Label htmlFor="sendNow" className="cursor-pointer text-sm">
                    Send now
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createLoading || !selectedListId || !selectedSender}>
                    {createLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {sendNow ? "Send Broadcast" : "Save as Draft"}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Warning if no synced lists */}
      {syncedLists.length === 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-900">No Lists Synced to Resend</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  You need to sync at least one list to Resend before creating broadcasts.{" "}
                  <a href="/emails/lists" className="underline font-medium">
                    Go to Lists →
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Broadcasts</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.sent} sent, {stats.drafts} drafts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRecipients}</div>
            <p className="text-xs text-muted-foreground">Emails delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Open Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.avgOpenRate}%</div>
            <p className="text-xs text-muted-foreground">Across all broadcasts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campaigns Sent</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sent}</div>
            <p className="text-xs text-muted-foreground">Successfully delivered</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter broadcasts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, subject, or list..."
                  value={globalFilter ?? ""}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Broadcasts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Broadcasts ({table.getFilteredRowModel().rows.length})</CardTitle>
          <CardDescription>Manage your newsletter campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        {broadcasts.length === 0 ? (
                          <div className="flex flex-col items-center gap-2 py-8">
                            <Mail className="h-12 w-12 text-muted-foreground/50" />
                            <p className="font-medium">No broadcasts created yet</p>
                            <p className="text-sm text-muted-foreground">
                              Create your first broadcast to start sending newsletters
                            </p>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">No broadcasts match your filters</p>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {table.getPageCount() > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing{" "}
                  {table.getState().pagination.pageIndex *
                    table.getState().pagination.pageSize +
                    1}{" "}
                  to{" "}
                  {Math.min(
                    (table.getState().pagination.pageIndex + 1) *
                      table.getState().pagination.pageSize,
                    table.getFilteredRowModel().rows.length
                  )}{" "}
                  of {table.getFilteredRowModel().rows.length} broadcast(s)
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
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

