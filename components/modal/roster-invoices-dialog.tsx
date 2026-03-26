"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertCircle, FileText, Clock, Ban, AlertTriangle } from "lucide-react"

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
  onRefresh?: () => void | Promise<void>
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function isOverdue(inv: RosterInvoice): boolean {
  if (inv.status !== "sent" || !inv.due_date) return false
  return new Date(inv.due_date) < new Date()
}

function StatusIcon({ inv }: { inv: RosterInvoice }) {
  const overdue = isOverdue(inv)

  if (inv.status === "paid")
    return <CheckCircle className="h-4 w-4 text-green-500" />
  if (inv.status === "sent" && overdue)
    return <AlertCircle className="h-4 w-4 text-red-500" />
  if (inv.status === "sent")
    return <Clock className="h-4 w-4 text-blue-500" />
  if (inv.status === "draft")
    return <FileText className="h-4 w-4 text-purple-500" />
  if (inv.status === "void")
    return <Ban className="h-4 w-4 text-slate-400" />
  return <FileText className="h-4 w-4 text-gray-400" />
}

export function RosterInvoicesDialog({
  open,
  onOpenChange,
  personName,
  teamName,
  invoices,
  onRefresh,
}: RosterInvoicesDialogProps) {
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [confirmVoidInvoice, setConfirmVoidInvoice] = useState<RosterInvoice | null>(null)

  const totalInvoiced = invoices
    .filter((inv) => inv.status !== "void")
    .reduce(
      (sum, inv) => sum + (inv.amount != null ? Number(inv.amount) : 0),
      0,
    )
  const totalCollected = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + (inv.amount != null ? Number(inv.amount) : 0), 0)

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

  async function handleVoid(invoiceId: string) {
    setVoidingId(invoiceId)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/void`, {
        method: "POST",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok)
        throw new Error((data as { error?: string }).error || "Failed to void invoice")
      toast.success("Invoice voided")
      if (onRefresh) await onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Void failed")
    } finally {
      setVoidingId(null)
      setConfirmVoidInvoice(null)
    }
  }

  const sorted = [...invoices].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0
    const tb = b.created_at ? Date.parse(b.created_at) : 0
    return tb - ta
  })

  const confirmVoidAmount = confirmVoidInvoice?.amount != null
    ? `$${Number(confirmVoidInvoice.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    : ""

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setConfirmVoidInvoice(null)
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-md sm:max-w-lg">
        {confirmVoidInvoice ? (
          <>
            <DialogHeader>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <DialogTitle className="text-center">Void this invoice?</DialogTitle>
              <DialogDescription className="text-center">
                This will void{" "}
                {confirmVoidInvoice.invoice_number
                  ? `invoice #${confirmVoidInvoice.invoice_number}`
                  : "this invoice"}
                {confirmVoidAmount ? ` (${confirmVoidAmount})` : ""} for {personName}.
                The invoice will be canceled in Stripe and can no longer be paid. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setConfirmVoidInvoice(null)}
                disabled={voidingId !== null}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleVoid(confirmVoidInvoice.id)}
                disabled={voidingId !== null}
              >
                {voidingId ? "Voiding…" : "Void Invoice"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invoices</DialogTitle>
              <DialogDescription>
                {personName} · {teamName}
              </DialogDescription>
            </DialogHeader>

            {invoices.length > 0 ? (
              <div className="flex items-baseline justify-between rounded-lg border px-4 py-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total invoiced
                  </p>
                  <p className="font-mono text-lg font-semibold tabular-nums">
                    ${totalInvoiced.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Collected
                  </p>
                  <p className="font-mono text-lg font-semibold tabular-nums">
                    ${totalCollected.toFixed(2)}
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
                  const canVoid = inv.status === "sent" || inv.status === "draft" || inv.status === "overdue"
                  const amount = inv.amount != null
                    ? `$${Number(inv.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                    : "—"

                  return (
                    <li
                      key={inv.id}
                      className={`rounded-lg border px-3 py-2.5 ${inv.status === "void" ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <StatusIcon inv={inv} />

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight">
                            {inv.invoice_number ? `#${inv.invoice_number}` : inv.id.slice(0, 8)}
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                            {amount}
                            {inv.created_at ? ` · ${formatDate(inv.created_at)}` : ""}
                          </p>
                        </div>

                        {(canResend || canVoid) ? (
                          <div className="flex shrink-0 items-center gap-0.5">
                            {canVoid && (
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={voidingId != null || resendingId != null}
                                onClick={() => setConfirmVoidInvoice(inv)}
                                title="Void invoice"
                                className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canResend && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={resendingId != null || voidingId != null}
                                onClick={() => void handleResend(inv.id)}
                                className="h-7 px-2.5 text-[11px] text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                              >
                                {resendingId === inv.id ? "Sending…" : "Resend"}
                              </Button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
