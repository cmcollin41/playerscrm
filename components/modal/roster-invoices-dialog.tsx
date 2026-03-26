"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PaperAirplaneIcon } from "@heroicons/react/24/outline"
import { CheckCircle, AlertCircle, FileText, Clock } from "lucide-react"

interface RosterInvoice {
  id: string
  status: string
  amount?: number | null
  invoice_number?: string | null
  due_date?: string | null
  created_at?: string | null
}

export interface RosterInvoicesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  personName: string
  teamName: string
  invoices: RosterInvoice[]
  owedAmount: number | null
  paidTotal: number
  onRefresh?: () => void | Promise<void>
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function isOverdue(inv: RosterInvoice): boolean {
  if (inv.status !== "sent" || !inv.due_date) return false
  return new Date(inv.due_date) < new Date()
}

function statusBadge(inv: RosterInvoice) {
  const overdue = isOverdue(inv)

  switch (inv.status) {
    case "paid":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle className="mr-1 h-3 w-3" />
          Paid
        </Badge>
      )
    case "sent":
      return overdue ? (
        <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
          <AlertCircle className="mr-1 h-3 w-3" />
          Overdue
        </Badge>
      ) : (
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
          <Clock className="mr-1 h-3 w-3" />
          Sent
        </Badge>
      )
    case "draft":
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700">
          <FileText className="mr-1 h-3 w-3" />
          Draft
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-600">
          {inv.status}
        </Badge>
      )
  }
}

export function RosterInvoicesDialog({
  open,
  onOpenChange,
  personName,
  teamName,
  invoices,
  owedAmount,
  paidTotal,
  onRefresh,
}: RosterInvoicesDialogProps) {
  const [resendingId, setResendingId] = useState<string | null>(null)

  async function handleResend(invoiceId: string) {
    setResendingId(invoiceId)
    try {
      const res = await fetch("/api/invoices/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok)
        throw new Error((data as { error?: string }).error || "Failed to resend")
      toast.success("Invoice resent")
      if (onRefresh) await onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Resend failed")
    } finally {
      setResendingId(null)
    }
  }

  const sorted = [...invoices].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0
    const tb = b.created_at ? Date.parse(b.created_at) : 0
    return tb - ta
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invoices</DialogTitle>
          <DialogDescription>
            {personName} · {teamName}
          </DialogDescription>
        </DialogHeader>

        {owedAmount != null && owedAmount > 0 ? (
          <div className="flex items-baseline justify-between rounded-lg border px-4 py-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Roster owed
              </p>
              <p className="font-mono text-lg font-semibold tabular-nums">
                ${owedAmount.toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Collected
              </p>
              <p className="font-mono text-lg font-semibold tabular-nums">
                ${paidTotal.toFixed(2)}
              </p>
            </div>
          </div>
        ) : null}

        {sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No invoices linked to this roster yet.
          </p>
        ) : (
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {sorted.map((inv) => {
              const canResend = inv.status === "sent"
              return (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {statusBadge(inv)}
                      <span className="truncate text-sm font-medium">
                        {inv.invoice_number || inv.id.slice(0, 8)}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {inv.amount != null ? (
                        <span className="font-mono tabular-nums">
                          ${Number(inv.amount).toFixed(2)}
                        </span>
                      ) : null}
                      {inv.due_date ? (
                        <span>Due {formatDate(inv.due_date)}</span>
                      ) : null}
                      {inv.created_at ? (
                        <span>Created {formatDate(inv.created_at)}</span>
                      ) : null}
                    </div>
                  </div>
                  {canResend ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={resendingId != null}
                      onClick={() => void handleResend(inv.id)}
                      className="shrink-0 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <PaperAirplaneIcon className="mr-1 h-3 w-3" />
                      {resendingId === inv.id ? "Sending…" : "Resend"}
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
