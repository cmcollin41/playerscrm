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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { DocumentIcon, ChevronDownIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"
import { postRosterInvoice } from "@/lib/post-roster-invoice"
import { effectiveRosterOwedDollars } from "@/lib/roster-pricing"

type PricingMode = "preset" | "custom"

interface FeeRow {
  id: string
  name: string
  amount: number
}

function draftRosterForPreview(
  roster: any,
  pricingMode: PricingMode,
  selectedFeeId: string | undefined,
  fees: FeeRow[],
  customAmountInput: string,
): any {
  const trim = customAmountInput.trim()
  const feeRow =
    pricingMode === "preset" && selectedFeeId
      ? fees.find((f) => f.id === selectedFeeId) ??
        (roster?.fees?.id === selectedFeeId ? roster.fees : undefined)
      : undefined

  return {
    ...roster,
    fee_id:
      pricingMode === "preset" && selectedFeeId ? selectedFeeId : null,
    fees: pricingMode === "preset" ? feeRow ?? null : null,
    custom_amount:
      pricingMode === "custom" && trim
        ? Number.parseFloat(trim)
        : null,
  }
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
  const [fees, setFees] = useState<FeeRow[]>([])
  const [selectedFeeId, setSelectedFeeId] = useState<string | undefined>(
    undefined,
  )
  const [customAmountInput, setCustomAmountInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [pricingMode, setPricingMode] = useState<PricingMode>("preset")
  const [wizardStep, setWizardStep] = useState<1 | 2>(1)
  const [savedOwedForInvoice, setSavedOwedForInvoice] = useState<number | null>(
    null,
  )
  const [customInvoiceMemo, setCustomInvoiceMemo] = useState("")

  const [unlinkedInvoices, setUnlinkedInvoices] = useState<UnlinkedInvoiceRow[]>([])
  const [linkingInvoiceId, setLinkingInvoiceId] = useState<string | null>(null)

  const openSessionRef = useRef(false)

  const personName = `${person.first_name} ${person.last_name}`
  const defaultRosterInvoiceMemo = `Team Roster Fee - ${personName} - ${teamName}`
  const guardianEmail = person.primary_contacts?.[0]?.email

  useEffect(() => {
    if (!open) {
      setWizardStep(1)
      setSavedOwedForInvoice(null)
      setCustomInvoiceMemo("")
      setUnlinkedInvoices([])
      setLinkingInvoiceId(null)
      openSessionRef.current = false
      return
    }

    if (wizardStep !== 1) return

    const justOpened = !openSessionRef.current
    openSessionRef.current = true

    if (justOpened) {
      const desiredFeeIdRaw =
        roster?.fee_id ?? roster?.fees?.id ?? currentFeeId ?? null
      const desiredFeeId = desiredFeeIdRaw ? String(desiredFeeIdRaw) : undefined

      setPricingMode("preset")
      setCustomAmountInput("")
      setSelectedFeeId(desiredFeeId)
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
  }, [open, wizardStep, rosterId, accountId, person.id, roster, currentFeeId, supabase])

  function handlePricingModeChange(useCustom: boolean) {
    if (useCustom) {
      setPricingMode("custom")
      setSelectedFeeId(undefined)
      setCustomAmountInput("")
      setCustomInvoiceMemo((prev) =>
        prev.trim() === "" ? defaultRosterInvoiceMemo : prev,
      )
    } else {
      setPricingMode("preset")
      setCustomAmountInput("")
      setCustomInvoiceMemo("")
      const back =
        roster?.fee_id ?? roster?.fees?.id ?? currentFeeId ?? null
      setSelectedFeeId(back ? String(back) : undefined)
    }
  }

  const draftRoster = draftRosterForPreview(
    roster,
    pricingMode,
    selectedFeeId,
    fees,
    customAmountInput,
  )
  const rosterOwed = effectiveRosterOwedDollars(draftRoster)

  async function handleSaveBilling(e: React.FormEvent) {
    e.preventDefault()
    if (!rosterId) return
    setSaving(true)
    try {
      const updateData: Record<string, unknown> = {}
      if (pricingMode === "preset") {
        updateData.fee_id =
          !selectedFeeId || selectedFeeId === "none" ? null : selectedFeeId
        updateData.custom_amount = null
      } else {
        updateData.fee_id = null
        const customTrim = customAmountInput.trim()
        if (!customTrim) {
          updateData.custom_amount = null
        } else {
          const n = Number.parseFloat(customTrim)
          if (Number.isNaN(n) || n <= 0)
            throw new Error("Custom amount must be a positive number")
          updateData.custom_amount = n
        }
      }

      const saveRes = await fetch(`/api/rosters/${rosterId}/billing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fee_id: updateData.fee_id ?? null,
          custom_amount: updateData.custom_amount ?? null,
        }),
      })
      if (!saveRes.ok) {
        const errBody = await saveRes.json().catch(() => ({}))
        throw new Error(
          (errBody as { error?: string }).error || "Failed to save billing",
        )
      }

      toast.success("Billing saved")
      if (onRefresh) await onRefresh()
      else refresh()
      const owedAfter = effectiveRosterOwedDollars(
        draftRosterForPreview(roster, pricingMode, selectedFeeId, fees, customAmountInput),
      )
      setSavedOwedForInvoice(
        owedAfter != null && owedAfter > 0 ? owedAfter : null,
      )
      setWizardStep(2)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
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

  async function handleCreateInvoice() {
    if (!guardianEmail) {
      toast.error("Add a primary contact email first")
      return
    }
    const amount =
      savedOwedForInvoice ??
      (rosterOwed != null && rosterOwed > 0 ? rosterOwed : null)
    if (amount == null || amount <= 0) {
      toast.error("Set a fee or custom amount in step 1 first")
      return
    }
    if (!team?.accounts?.stripe_id) {
      toast.error("Connect Stripe on this account first")
      return
    }
    setCreatingInvoice(true)
    try {
      await postRosterInvoice({
        rosterId,
        athleteName: personName,
        teamName,
        amount,
        guardianEmail,
        payerPersonId: person.primary_contacts?.[0]?.id,
        description:
          pricingMode === "custom" && customInvoiceMemo.trim() !== ""
            ? customInvoiceMemo.trim()
            : undefined,
        accountId: team.account_id,
        stripeAccountId: team.accounts.stripe_id,
        person_id: person.id,
      })
      toast.success("Invoice created and emailed to the primary contact")
      if (onRefresh) await onRefresh()
      else refresh()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invoice failed")
    } finally {
      setCreatingInvoice(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(85vh,720px)] max-h-[90vh] w-full max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 space-y-1.5 border-b border-zinc-200 px-6 pb-4 pt-6 pr-14 text-left dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <DialogTitle>
              {wizardStep === 1 ? "Player billing" : "Send invoice"}
            </DialogTitle>
            <span className="rounded-full border bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:bg-zinc-800">
              Step {wizardStep} of 2
            </span>
          </div>
          <DialogDescription>
            {wizardStep === 1
              ? `${personName} · ${teamName}`
              : "Billing saved. Create and email a Stripe invoice for the amount below, or close without sending."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div
            className={cn(
              "flex h-full min-h-[min(360px,50vh)] w-[200%] transition-transform duration-300 ease-out motion-reduce:transition-none",
              wizardStep === 1 ? "translate-x-0" : "-translate-x-1/2",
            )}
          >
            {/* ── Step 1: fee / custom amount ── */}
            <div className="h-full w-1/2 shrink-0 overflow-y-auto overscroll-contain px-6 py-4">
              <form
                id="roster-billing-form"
                className="space-y-4"
                onSubmit={handleSaveBilling}
              >
                <div className="flex flex-row items-center justify-between gap-3 rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="pricing-custom-mode" className="text-base">
                      Custom amount
                    </Label>
                    <p className="text-xs text-muted-foreground pr-2">
                      Use a one-off amount instead of a preset fee for this
                      invoice.
                    </p>
                  </div>
                  <Switch
                    id="pricing-custom-mode"
                    checked={pricingMode === "custom"}
                    onCheckedChange={handlePricingModeChange}
                  />
                </div>

                {pricingMode === "preset" ? (
                  <div className="space-y-2">
                    <Label htmlFor="bill_fee">Fee</Label>
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
                    <Label htmlFor="bill_custom">Amount ($)</Label>
                    <Input
                      id="bill_custom"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="e.g. 175.00"
                      value={customAmountInput}
                      onChange={(e) => setCustomAmountInput(e.target.value)}
                    />
                    <div className="space-y-2 pt-1">
                      <Label htmlFor="bill_custom_memo">
                        Invoice description / memo
                      </Label>
                      <Textarea
                        id="bill_custom_memo"
                        className="min-h-[88px] resize-y"
                        placeholder={defaultRosterInvoiceMemo}
                        value={customInvoiceMemo}
                        onChange={(e) => setCustomInvoiceMemo(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Shown on the Stripe invoice line item. Leave blank to use
                        the default roster fee text.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Link orphan invoices (cleanup tool) ── */}
                {unlinkedInvoices.length > 0 ? (
                  <Collapsible>
                    <CollapsibleTrigger className="flex w-full items-center gap-2 border-t border-zinc-200 pt-4 text-sm font-medium text-muted-foreground hover:text-foreground dark:border-zinc-800">
                      <ChevronDownIcon className="h-4 w-4 shrink-0 transition-transform [[data-state=open]>&]:rotate-180" />
                      {unlinkedInvoices.length} unlinked invoice
                      {unlinkedInvoices.length !== 1 ? "s" : ""} for this person
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <p className="mb-2 text-xs text-muted-foreground">
                        These invoices aren't tied to any roster yet. Link one to
                        associate it with this roster spot.
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
              </form>
            </div>

            {/* ── Step 2: create & send invoice ── */}
            <div className="h-full w-1/2 shrink-0 overflow-y-auto overscroll-contain px-6 py-4">
              <div className="space-y-4">
                <div className="rounded-xl border border-green-200/80 bg-green-50/80 px-4 py-4 dark:border-green-900/50 dark:bg-green-950/30">
                  <p className="text-xs font-medium uppercase tracking-wide text-green-800 dark:text-green-200">
                    Amount to invoice
                  </p>
                  <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-green-900 dark:text-green-50">
                    {savedOwedForInvoice != null && savedOwedForInvoice > 0
                      ? `$${savedOwedForInvoice.toFixed(2)}`
                      : "—"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Based on the fee / custom amount you just saved for{" "}
                    {personName} on {teamName}.
                  </p>
                </div>

                <p className="text-sm text-muted-foreground">
                  A new Stripe invoice will be created, finalized, and{" "}
                  <span className="font-medium text-foreground">
                    emailed to the primary contact
                  </span>{" "}
                  ({guardianEmail || "none on file"}).
                  The invoice is automatically linked to this roster.
                </p>

                {!guardianEmail ? (
                  <p className="text-xs text-amber-700">
                    Add a primary contact with email before sending invoices.
                  </p>
                ) : null}

                {savedOwedForInvoice == null || savedOwedForInvoice <= 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No billable amount set. Use{" "}
                    <span className="font-medium">Back</span> to pick a fee or
                    enter a custom amount, then save again.
                  </p>
                ) : null}

                <Button
                  type="button"
                  variant="default"
                  className="w-full bg-green-700 text-white hover:bg-green-800 h-11"
                  disabled={
                    creatingInvoice ||
                    savedOwedForInvoice == null ||
                    savedOwedForInvoice <= 0 ||
                    !guardianEmail
                  }
                  onClick={() => void handleCreateInvoice()}
                >
                  <DocumentIcon className="h-4 w-4 mr-2 shrink-0" />
                  {creatingInvoice
                    ? "Sending…"
                    : savedOwedForInvoice != null && savedOwedForInvoice > 0
                      ? `Create & email invoice for $${savedOwedForInvoice.toFixed(2)}`
                      : "Set amount in step 1"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-wrap gap-2 border-t border-zinc-200 bg-zinc-50/90 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/90 sm:flex-row sm:justify-end sm:space-x-2">
          {wizardStep === 1 ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Close
              </Button>
              <Button
                type="submit"
                form="roster-billing-form"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save and continue"}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setWizardStep(1)}
                disabled={saving || creatingInvoice}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={creatingInvoice}
              >
                Close without sending
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
