"use client"

import { useState, useMemo } from "react"
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
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  DollarSign,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  RotateCw,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"

interface Invoice {
  id: string
  created_at: string
  amount: number
  status: string
  due_date: string | null
  invoice_number: string | null
  description: string | null
  person: {
    id: string
    first_name: string
    last_name: string
    email: string
    dependent: boolean
  } | null
  roster: {
    id: string
    team: {
      id: string
      name: string
    }
  } | null
  payments: Array<{
    id: string
    amount: number
    status: string
    created_at: string
  }> | null
}

interface InvoicesClientProps {
  invoices: Invoice[]
  accountId: string
}

type SortField = "created_at" | "amount" | "due_date" | "person"
type SortDirection = "asc" | "desc"

const isOverdue = (invoice: Invoice) =>
  invoice.status === "sent" &&
  invoice.due_date &&
  new Date(invoice.due_date) < new Date()

const getStatusBadge = (status: string, overdue: boolean) => {
  if (overdue) {
    return (
      <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100">
        <AlertTriangle className="h-3 w-3 mr-1" />
        OVERDUE
      </Badge>
    )
  }

  const config: Record<string, { className: string; icon: React.ElementType }> = {
    draft: { className: "bg-gray-100 text-gray-800 hover:bg-gray-100", icon: FileText },
    sent: { className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100", icon: Clock },
    paid: { className: "bg-green-100 text-green-800 hover:bg-green-100", icon: CheckCircle2 },
  }

  const statusConfig = config[status] || config.sent
  const Icon = statusConfig.icon

  return (
    <Badge variant="outline" className={statusConfig.className}>
      <Icon className="h-3 w-3 mr-1" />
      {status.toUpperCase()}
    </Badge>
  )
}

export default function InvoicesClient({ invoices, accountId }: InvoicesClientProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [resendingInvoiceId, setResendingInvoiceId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 25

  const stats = useMemo(() => {
    const total = invoices.length
    const sent = invoices.filter(inv => inv.status === "sent").length
    const paid = invoices.filter(inv => inv.status === "paid").length
    const draft = invoices.filter(inv => inv.status === "draft").length
    const overdue = invoices.filter(inv => isOverdue(inv)).length
    const sentOrPaid = sent + paid
    const totalAmount = invoices
      .filter(inv => inv.status === "sent" || inv.status === "paid")
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
    const paidAmount = invoices
      .filter(inv => inv.status === "paid")
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
    const overdueAmount = invoices
      .filter(inv => isOverdue(inv))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)

    return { total, sent, paid, draft, overdue, sentOrPaid, totalAmount, paidAmount, overdueAmount }
  }, [invoices])

  const filteredInvoices = useMemo(() => {
    let filtered = invoices

    if (statusFilter === "overdue") {
      filtered = filtered.filter(inv => isOverdue(inv))
    } else if (statusFilter === "unpaid") {
      filtered = filtered.filter(inv => inv.status !== "paid" && inv.status !== "draft")
    } else if (statusFilter !== "all") {
      filtered = filtered.filter(inv => inv.status === statusFilter)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(inv => {
        const personName = inv.person
          ? `${inv.person.first_name} ${inv.person.last_name}`.toLowerCase()
          : ""
        const email = inv.person?.email?.toLowerCase() || ""
        const description = inv.description?.toLowerCase() || ""
        const invoiceNumber = inv.invoice_number?.toLowerCase() || ""
        const teamName = inv.roster?.team?.name?.toLowerCase() || ""

        return (
          personName.includes(query) ||
          email.includes(query) ||
          description.includes(query) ||
          invoiceNumber.includes(query) ||
          teamName.includes(query)
        )
      })
    }

    filtered.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortField) {
        case "created_at":
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
        case "amount":
          aValue = a.amount
          bValue = b.amount
          break
        case "due_date":
          aValue = a.due_date ? new Date(a.due_date).getTime() : 0
          bValue = b.due_date ? new Date(b.due_date).getTime() : 0
          break
        case "person":
          aValue = a.person ? `${a.person.first_name} ${a.person.last_name}` : ""
          bValue = b.person ? `${b.person.first_name} ${b.person.last_name}` : ""
          break
        default:
          return 0
      }

      return sortDirection === "asc"
        ? aValue > bValue ? 1 : -1
        : aValue < bValue ? 1 : -1
    })

    return filtered
  }, [invoices, searchQuery, statusFilter, sortField, sortDirection])

  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredInvoices.slice(start, start + pageSize)
  }, [filteredInvoices, currentPage, pageSize])

  const totalPages = Math.ceil(filteredInvoices.length / pageSize)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
    setCurrentPage(1)
  }

  const handleResendInvoice = async (invoiceId: string) => {
    setResendingInvoiceId(invoiceId)

    try {
      const response = await fetch("/api/invoices/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to resend invoice")

      toast.success("Invoice email resent successfully!")
      router.refresh()
    } catch (error: any) {
      console.error("Error resending invoice:", error)
      toast.error(error.message || "Failed to resend invoice")
    } finally {
      setResendingInvoiceId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invoices Sent</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sentOrPaid}</div>
            <p className="text-xs text-muted-foreground">
              {stats.sent} awaiting payment, {stats.paid} paid{stats.draft > 0 ? `, ${stats.draft} draft` : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Amount Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${stats.paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              of ${stats.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">
              ${stats.overdueAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} outstanding
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.sentOrPaid > 0 ? Math.round((stats.paid / stats.sentOrPaid) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.paid} of {stats.sentOrPaid} invoices paid
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice List */}
      <Card>
        <CardHeader>
          <CardTitle>All Invoices ({filteredInvoices.length})</CardTitle>
          <CardDescription>
            Complete list of all invoices with their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full space-y-4">
            <div className="flex items-center gap-4">
              <Input
                placeholder="Search by name, email, invoice #, or team..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="max-w-sm"
              />
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent (Awaiting Payment)</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="unpaid">All Unpaid</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortField} onValueChange={(value) => {
                handleSort(value as SortField)
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Sort by Date</SelectItem>
                  <SelectItem value="amount">Sort by Amount</SelectItem>
                  <SelectItem value="due_date">Sort by Due Date</SelectItem>
                  <SelectItem value="person">Sort by Recipient</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {paginatedInvoices.length ? (
              <div className="divide-y rounded-md border">
                {paginatedInvoices.map((invoice) => {
                  const overdue = isOverdue(invoice)
                  const person = invoice.person

                  return (
                    <div
                      key={invoice.id}
                      className={`flex gap-4 px-5 py-4 hover:bg-muted/50 transition-colors ${overdue ? "bg-red-50/40" : ""}`}
                    >
                      <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                        <AvatarFallback className="text-xs">
                          {person
                            ? getInitials(person.first_name, person.last_name)
                            : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-2.5">
                        {/* Row 1: Recipient + amount */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {person ? (
                              <span className="text-[15px] font-semibold truncate">
                                {person.first_name} {person.last_name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Unknown recipient</span>
                            )}
                            {person?.dependent && (
                              <Badge variant="outline" className="text-[10px]">
                                Dependent
                              </Badge>
                            )}
                            {invoice.roster?.team && (
                              <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex">
                                {invoice.roster.team.name}
                              </Badge>
                            )}
                          </div>
                          <span className="text-[15px] font-bold tabular-nums shrink-0">
                            ${invoice.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Row 2: Description */}
                        <p className="text-sm font-medium text-foreground/90 truncate leading-tight">
                          {invoice.description || <span className="text-muted-foreground italic">No description</span>}
                        </p>

                        {/* Row 3: Invoice # + due date */}
                        <div className="flex items-center gap-2">
                          {invoice.invoice_number && (
                            <>
                              <span className="text-[13px] text-muted-foreground/70 font-mono">
                                #{invoice.invoice_number}
                              </span>
                              <span className="text-muted-foreground/30">·</span>
                            </>
                          )}
                          {invoice.due_date && (
                            <span className={`text-[13px] ${overdue ? "text-red-600 font-medium" : "text-muted-foreground/70"}`}>
                              Due {new Date(invoice.due_date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                              {overdue && " — overdue"}
                            </span>
                          )}
                          {person?.email && (
                            <>
                              <span className="text-muted-foreground/30">·</span>
                              <span className="text-[13px] text-muted-foreground/70 truncate hidden md:inline">
                                {person.email}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Row 4: Status + date + actions — visually separated */}
                        <div className="flex items-center justify-between pt-1 border-t border-border/40">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(invoice.status, !!overdue)}
                            <span className="text-[11px] text-muted-foreground/60">
                              {new Date(invoice.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                            <span className="text-muted-foreground/30">·</span>
                            <span className="text-[11px] text-muted-foreground/60">
                              {formatDistanceToNow(new Date(invoice.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          {invoice.status === "sent" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendInvoice(invoice.id)}
                              disabled={resendingInvoiceId === invoice.id}
                              className={`h-7 text-xs ${
                                overdue
                                  ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                                  : "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              }`}
                            >
                              {resendingInvoiceId === invoice.id ? (
                                <>
                                  <RotateCw className="h-3 w-3 mr-1 animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Send className="h-3 w-3 mr-1" />
                                  Resend
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-md border">
                {invoices.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12">
                    <FileText className="h-12 w-12 text-muted-foreground/50" />
                    <p className="font-medium">No invoices yet</p>
                    <p className="text-sm text-muted-foreground">
                      Create your first invoice to get started
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground">No invoices match your filters</p>
                  </div>
                )}
              </div>
            )}

            {/* Pagination Controls */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to{" "}
                {Math.min(currentPage * pageSize, filteredInvoices.length)}{" "}
                of {filteredInvoices.length} invoice(s)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages || 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={currentPage >= totalPages}
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
