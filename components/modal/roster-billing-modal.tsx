"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { getAccount } from "@/lib/fetchers/client"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { DocumentIcon, ChevronDownIcon } from "@heroicons/react/24/outline"
import { postRosterInvoice } from "@/lib/post-roster-invoice"
import { rosterTemplateDollars } from "@/lib/roster-pricing"

type BillingTab = "fee" | "invoice" | "status"

interface FeeRow {
  id: string
  name: string
  amount: number
}

interface UnlinkedInvoiceRow {
  id: string
  invoice_number: string | null
  amount: number | null
  status: string
}

export interface RosterBillingPerson {
  id: string
  first_name: string
  last_name: string
  primary_contacts: any[]
}

export interface RosterBillingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rosterId: string
  teamName: string
  person: RosterBillingPerson
  roster: any
  team: any
  account: any
  currentFeeId: string | null
  accountId: string
  onRefresh?: () => void | Promise<void>
}

export function RosterBillingModal({
  open,
  onOpenChange,
  rosterId,
  teamName,
  person,
  roster,
  team,
  account,
  currentFeeId,
  accountId,
  onRefresh,
}: RosterBillingModalProps) {
  const { refresh } = useRouter()
  const supabase = createClient()

  const [billingTab, setBillingTab] = useState<BillingTab>("fee")

  // Fee tab
  const [fees, setFees] = useState<FeeRow[]>([])
  const [selectedFeeId, setSelectedFeeId] = useState<string | undefined>(undefined)
  const [customAmountInput, setCustomAmountInput] = useState("")
  const [useCustomFee, setUseCustomFee] = useState(false)
  const [savingFee, setSavingFee] = useState(false)

  // Invoice tab
  const [invoiceAmountInput, setInvoiceAmountInput] = useState("")
  const [invoiceMemo, setInvoiceMemo] = useState("")
  const [sendingInvoice, setSendingInvoice] = useState(false)

  // Status tab
  const [paymentStatus, setPaymentStatus] = useState<string>("paid")
  const [paymentStatusNote, setPaymentStatusNote] = useState("")
  const [savingStatus, setSavingStatus] = useState(false)

  // Unlinked invoices
  const [unlinkedInvoices, setUnlinkedInvoices] = useState<UnlinkedInvoiceRow[]>([])
  const [linkingInvoiceId, setLinkingInvoiceId] = useState<string | null>(null)

  const openSessionRef = useRef(false)

  const personName = `${person.first_name} ${person.last_name}`
  const defaultInvoiceMemo = `Team Roster Fee - ${personName} - ${teamName}`
  const guardianEmail = person.primary_contacts?.[0]?.email
  const currentFeeAmount = rosterTemplateDollars(roster)

  useEffect(() => {
    if (!open) {
      openSessionRef.current = false
      return
    }

    const justOpened = !openSessionRef.current
    openSessionRef.current = true

    if (justOpened) {
      const desiredFeeIdRaw =
        roster?.fee_id ?? roster?.fees?.id ?? currentFeeId ?? null
      const desiredFeeId = desiredFeeIdRaw ? String(desiredFeeIdRaw) : undefined
      setSelectedFeeId(desiredFeeId)

      const hasCustom =
        roster?.custom_amount != null && Number(roster.custom_amount) > 0
      setUseCustomFee(hasCustom)
      setCustomAmountInput(hasCustom ? String(roster.custom_amount) : "")

      const feeAmt = rosterTemplateDollars(roster)
      setInvoiceAmountInput(
        feeAmt != null && feeAmt > 0 ? feeAmt.toFixed(2) : "",
      )
      setInvoiceMemo("")

      if (roster?.payment_status === "paid" || roster?.payment_status === "waived") {
        setBillingTab("status")
        setPaymentStatus(roster.payment_status)
        setPaymentStatusNote(roster.payment_status_note ?? (roster.payment_status === "paid" ? "cash" : ""))
      } else {
        setBillingTab("fee")
        setPaymentStatus("paid")
        setPaymentStatusNote("cash")
      }

      setUnlinkedInvoices([])
      setLinkingInvoiceId(null)
    }

    const load = async () => {
      const acc = await getAccount()
      const { data: feesData } = await supabase
        .from("fees")
        .select("id, name, amount")
        .eq("is_active", true)
        .eq("account_id", acc?.id ?? accountId)
      setFees(feesData ?? [])

      if (justOpened) {
        const desiredFeeIdRaw =
          roster?.fee_id ?? roster?.fees?.id ?? currentFeeId ?? null
        const desiredFeeId = desiredFeeIdRaw ? String(desiredFeeIdRaw) : undefined
        setSelectedFeeId(desiredFeeId ?? undefined)
      }

      if (person.id && accountId) {
        const { data: invData } = await supabase
          .from("invoices")
          .select("id, invoice_number, amount, status, roster_id")
          .eq("person_id", person.id)
          .eq("account_id", accountId)
          .is("roster_id", null)
          .neq("status", "void")
          .order("created_at", { ascending: false })
        setUnlinkedInvoices(
          (invData ?? []).map((r) => ({
            id: r.id,
            invoice_number: r.invoice_number,
            amount: r.amount,
            status: r.status,
          })),
        )
      }
    }

    void load()
  }, [open, rosterId, accountId, person.id, roster, currentFeeId, supabase])

  async function handleSaveFee() {
    if (!rosterId) return
    setSavingFee(true)
    try {
      const feeId =
        !useCustomFee && selectedFeeId && selectedFeeId !== "none"
          ? selectedFeeId
          : null
      let customAmount: number | null = null
      if (useCustomFee) {
        const n = Number.parseFloat(customAmountInput.trim())
        if (Number.isNaN(n) || n <= 0)
          throw new Error("Custom fee must be a positive number")
        customAmount = n
      }

      const res = await fetch(`/api/rosters/${rosterId}/billing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fee_id: feeId,
          custom_amount: useCustomFee ? customAmount : null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error || "Failed to save fee")
      }

      toast.success("Fee saved")
      if (onRefresh) await onRefresh()
      else refresh()

      const newFee = useCustomFee
        ? customAmount
        : fees.find((f) => f.id === feeId)?.amount ?? null
      if (newFee != null && newFee > 0)
        setInvoiceAmountInput(newFee.toFixed(2))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSavingFee(false)
    }
  }

  async function handleSaveStatus() {
    if (!rosterId) return
    setSavingStatus(true)
    try {
      const res = await fetch(`/api/rosters/${rosterId}/billing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_status: paymentStatus,
          payment_status_note: paymentStatusNote.trim() || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error || "Failed to save status")
      }

      toast.success("Payment status saved")
      if (onRefresh) await onRefresh()
      else refresh()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSavingStatus(false)
    }
  }

  async function handleSendInvoice() {
    if (!guardianEmail) {
      toast.error("Add a primary contact email first")
      return
    }
    const rawAmt = Number.parseFloat(invoiceAmountInput.trim())
    if (Number.isNaN(rawAmt) || rawAmt <= 0) {
      toast.error("Enter a valid invoice amount")
      return
    }
    if (!team?.accounts?.stripe_id) {
      toast.error("Connect Stripe on this account first")
      return
    }
    setSendingInvoice(true)
    try {
      await postRosterInvoice({
        rosterId,
        athleteName: personName,
        teamName,
        amount: rawAmt,
        guardianEmail,
        payerPersonId: person.primary_contacts?.[0]?.id,
        description: invoiceMemo.trim() || undefined,
        accountId: team.account_id,
        stripeAccountId: team.accounts.stripe_id,
        person_id: person.id,
      })
      toast.success("Invoice created and emailed")
      if (onRefresh) await onRefresh()
      else refresh()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invoice failed")
    } finally {
      setSendingInvoice(false)
    }
  }

  async function handleLinkInvoice(invoiceId: string) {
    setLinkingInvoiceId(invoiceId)
    try {
      const res = await fetch(`/api/rosters/${rosterId}/link-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error || "Failed to link invoice")
      }
      toast.success("Invoice linked to this roster")
      setUnlinkedInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId))
      if (onRefresh) await onRefresh()
      else refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Link failed")
    } finally {
      setLinkingInvoiceId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 space-y-1.5 border-b border-zinc-200 px-6 pb-4 pt-6 pr-14 text-left dark:border-zinc-800">
          <DialogTitle>Player billing</DialogTitle>
          <DialogDescription>
            {personName} · {teamName}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          <Tabs
            value={billingTab}
            onValueChange={(v) => setBillingTab(v as BillingTab)}
            className="w-full"
          >
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="fee">Fee</TabsTrigger>
              <TabsTrigger value="invoice">Invoice</TabsTrigger>
              <TabsTrigger value="status">Status</TabsTrigger>
            </TabsList>

            {/* ── Fee tab ── */}
            <TabsContent value="fee" className="space-y-4">
              {!useCustomFee ? (
                <div className="space-y-2">
                  <Label htmlFor="bill_fee">Preset fee</Label>
                  <Select
                    value={selectedFeeId || "none"}
                    onValueChange={(v) =>
                      setSelectedFeeId(v === "none" ? undefined : v)
                    }
                  >
                    <SelectTrigger id="bill_fee">
                      <SelectValue placeholder="No fee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No fee</SelectItem>
                      {fees.map((fee) => (
                        <SelectItem key={fee.id} value={fee.id}>
                          {fee.name} — ${fee.amount}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="bill_custom">Custom fee ($)</Label>
                  <Input
                    id="bill_custom"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. 75.00"
                    value={customAmountInput}
                    onChange={(e) => setCustomAmountInput(e.target.value)}
                  />
                </div>
              )}

              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => {
                  setUseCustomFee((prev) => !prev)
                  if (!useCustomFee) {
                    setSelectedFeeId(undefined)
                    setCustomAmountInput("")
                  } else {
                    setCustomAmountInput("")
                    const back =
                      roster?.fee_id ?? roster?.fees?.id ?? currentFeeId ?? null
                    setSelectedFeeId(back ? String(back) : undefined)
                  }
                }}
              >
                {useCustomFee
                  ? "Use a preset fee instead"
                  : "Use a custom fee amount"}
              </Button>

              {/* Link orphan invoices */}
              {unlinkedInvoices.length > 0 ? (
                <Collapsible>
                  <CollapsibleTrigger className="flex w-full items-center gap-2 border-t border-zinc-200 pt-4 text-sm font-medium text-muted-foreground hover:text-foreground dark:border-zinc-800">
                    <ChevronDownIcon className="h-4 w-4 shrink-0 transition-transform [[data-state=open]>&]:rotate-180" />
                    {unlinkedInvoices.length} unlinked invoice
                    {unlinkedInvoices.length !== 1 ? "s" : ""} for this person
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <p className="mb-2 text-xs text-muted-foreground">
                      These invoices aren&apos;t tied to any roster yet. Link
                      one to associate it with this roster spot.
                    </p>
                    <ul className="space-y-2">
                      {unlinkedInvoices.map((inv) => (
                        <li
                          key={inv.id}
                          className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <span className="truncate">
                            {inv.invoice_number || inv.id.slice(0, 8)}
                            {inv.amount != null
                              ? ` — $${Number(inv.amount).toFixed(2)}`
                              : ""}
                            {` · ${inv.status}`}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={linkingInvoiceId != null}
                            onClick={() => void handleLinkInvoice(inv.id)}
                          >
                            {linkingInvoiceId === inv.id ? "Linking…" : "Link"}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              ) : null}

              <Button
                type="button"
                className="w-full"
                disabled={savingFee}
                onClick={() => void handleSaveFee()}
              >
                {savingFee ? "Saving…" : "Save fee"}
              </Button>
            </TabsContent>

            {/* ── Invoice tab ── */}
            <TabsContent value="invoice" className="space-y-4">
              {currentFeeAmount != null && currentFeeAmount > 0 && (
                <div className="rounded-lg border bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Roster fee
                    </p>
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      ${currentFeeAmount.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="invoice_amount">Amount ($)</Label>
                <Input
                  id="invoice_amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 180.00"
                  value={invoiceAmountInput}
                  onChange={(e) => setInvoiceAmountInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Invoice the full fee or a partial amount for installments.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_memo">Description (optional)</Label>
                <Textarea
                  id="invoice_memo"
                  className="min-h-[72px] resize-y"
                  placeholder={defaultInvoiceMemo}
                  value={invoiceMemo}
                  onChange={(e) => setInvoiceMemo(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Shown as the line item on the Stripe invoice.
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                A Stripe invoice will be created and{" "}
                <span className="font-medium text-foreground">
                  emailed to the primary contact
                </span>{" "}
                ({guardianEmail || "none on file"}).
              </p>

              {!guardianEmail && (
                <p className="text-xs text-amber-700">
                  Add a primary contact with email before sending invoices.
                </p>
              )}

              <Button
                type="button"
                className="w-full bg-green-700 text-white hover:bg-green-800 h-11"
                disabled={
                  sendingInvoice ||
                  !invoiceAmountInput.trim() ||
                  Number.parseFloat(invoiceAmountInput) <= 0 ||
                  !guardianEmail
                }
                onClick={() => void handleSendInvoice()}
              >
                <DocumentIcon className="h-4 w-4 mr-2 shrink-0" />
                {sendingInvoice
                  ? "Sending…"
                  : invoiceAmountInput.trim() &&
                      Number.parseFloat(invoiceAmountInput) > 0
                    ? `Create & send invoice for $${Number.parseFloat(invoiceAmountInput).toFixed(2)}`
                    : "Enter an amount"}
              </Button>
            </TabsContent>

            {/* ── Status tab ── */}
            <TabsContent value="status" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Mark this roster spot as settled outside the invoicing flow.
              </p>

              <div className="space-y-2">
                <Label htmlFor="payment-status">Status</Label>
                <Select
                  value={paymentStatus}
                  onValueChange={setPaymentStatus}
                >
                  <SelectTrigger id="payment-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="waived">Waived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentStatus === "paid" && (
                <div className="space-y-2">
                  <Label htmlFor="payment-method">Payment method</Label>
                  <Select
                    value={paymentStatusNote || "cash"}
                    onValueChange={setPaymentStatusNote}
                  >
                    <SelectTrigger id="payment-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="venmo">Venmo</SelectItem>
                      <SelectItem value="cashapp">Cash App</SelectItem>
                      <SelectItem value="cash">Cash / Check</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {paymentStatus === "waived" && (
                <div className="space-y-2">
                  <Label htmlFor="waived-reason">Reason (optional)</Label>
                  <Input
                    id="waived-reason"
                    placeholder="e.g. scholarship, coach's family"
                    value={paymentStatusNote}
                    onChange={(e) => setPaymentStatusNote(e.target.value)}
                  />
                </div>
              )}

              <Button
                type="button"
                className="w-full"
                disabled={savingStatus}
                onClick={() => void handleSaveStatus()}
              >
                {savingStatus ? "Saving…" : "Save status"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
