"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const NO_ROSTER_VALUE = "__none__"

export interface InvoiceRosterOption {
  rosterId: string
  label: string
}

interface CreateInvoiceModalProps {
  person: any
  account: any
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Set from team roster row — invoice is always tied to this roster */
  lockedRosterId?: string | null
  lockedRosterLabel?: string | null
  /** Person page — optional roster link */
  rosterOptions?: InvoiceRosterOption[]
  onInvoiceCreated?: () => void
  /** When opening from billing, pre-fill Stripe line item (editable). */
  initialAmount?: string | null
  initialDescription?: string | null
}

export default function CreateInvoiceModal({
  person,
  account,
  open,
  onOpenChange,
  lockedRosterId = null,
  lockedRosterLabel = null,
  rosterOptions = [],
  onInvoiceCreated,
  initialAmount = null,
  initialDescription = null,
}: CreateInvoiceModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [selectedRosterId, setSelectedRosterId] = useState<string>(NO_ROSTER_VALUE)

  useEffect(() => {
    if (!open) return
    setAmount(
      initialAmount != null && String(initialAmount).trim() !== ""
        ? String(initialAmount)
        : "",
    )
    setDescription(initialDescription != null ? String(initialDescription) : "")
    if (lockedRosterId) {
      setSelectedRosterId(lockedRosterId)
    } else {
      setSelectedRosterId(NO_ROSTER_VALUE)
    }
  }, [open, lockedRosterId, initialAmount, initialDescription])

  const showRosterPicker =
    !lockedRosterId && rosterOptions && rosterOptions.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const numericAmount = parseFloat(amount)
      if (isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error("Please enter a valid amount")
      }

      const rosterIdToSend = lockedRosterId
        ? lockedRosterId
        : selectedRosterId !== NO_ROSTER_VALUE
          ? selectedRosterId
          : undefined

      const billEmail =
        person.email?.trim() ||
        person.primary_contacts?.[0]?.email?.trim() ||
        ""
      const usesGuardianEmail =
        !person.email?.trim() && !!person.primary_contacts?.[0]?.email?.trim()
      const guardianId = person.primary_contacts?.[0]?.id

      const customerResponse = await fetch("/api/stripe-customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: billEmail,
          accountId: account.id,
          ...(usesGuardianEmail && typeof guardianId === "string"
            ? { payerPersonId: guardianId, athletePersonId: person.id }
            : {}),
        }),
      })

      if (!customerResponse.ok) {
        throw new Error("Failed to create/get customer")
      }

      const { customerId } = await customerResponse.json()

      const invoiceResponse = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          amount: numericAmount,
          description,
          accountId: account.id,
          stripeAccountId: account.stripe_id,
          person_id: person.id,
          isCustomInvoice: true,
          ...(rosterIdToSend ? { rosterId: rosterIdToSend } : {}),
        })
      })

      if (!invoiceResponse.ok) {
        const error = await invoiceResponse.json()
        throw new Error(error.error || error.message || "Failed to create invoice")
      }

      toast.success("Invoice created and sent successfully")
      onInvoiceCreated?.()
      onOpenChange(false)
      setAmount("")
      setDescription("")
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Failed to create invoice")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {lockedRosterId
              ? "Invoice (custom line text)"
              : "Create invoice"}
          </DialogTitle>
          {lockedRosterLabel ? (
            <p className="text-sm text-muted-foreground font-normal pt-1">
              Linked to roster: {lockedRosterLabel}. For roster pricing, use{" "}
              <strong>Save billing</strong> and &quot;Create invoice&quot; in
              player billing. Open this when you need different Stripe wording or
              a one-off amount (equipment, partial pay, etc.).
            </p>
          ) : (
            <p className="text-sm text-muted-foreground font-normal pt-1">
              One-off Stripe invoice with your description and amount.
            </p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Amount ($)</label>
            <Input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Line item description
            </label>
            <Input
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Team Jersey"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Appears as the line item on the Stripe invoice.
            </p>
          </div>

          {showRosterPicker ? (
            <div>
              <label className="block text-sm font-medium mb-1">
                Team roster (optional)
              </label>
              <Select
                value={selectedRosterId}
                onValueChange={setSelectedRosterId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Link to a team…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ROSTER_VALUE}>
                    No team link (account-wide)
                  </SelectItem>
                  {rosterOptions.map((opt) => (
                    <SelectItem key={opt.rosterId} value={opt.rosterId}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Linking a roster matches this invoice to that team in the roster table.
              </p>
            </div>
          ) : null}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create invoice"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
