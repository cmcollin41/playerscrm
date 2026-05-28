"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
import { PaymentOverrideFields } from "@/components/payments/payment-override-fields"

export interface EventRegistrationPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  registrationId: string | null
  personName: string
  initialStatus?: "paid" | "waived" | null
  initialNote?: string | null
}

export function EventRegistrationPaymentModal({
  open,
  onOpenChange,
  registrationId,
  personName,
  initialStatus,
  initialNote,
}: EventRegistrationPaymentModalProps) {
  const router = useRouter()

  const [paymentStatus, setPaymentStatus] = useState<"paid" | "waived">("paid")
  const [paymentStatusNote, setPaymentStatusNote] = useState("cash")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initialStatus === "paid" || initialStatus === "waived") {
      setPaymentStatus(initialStatus)
      setPaymentStatusNote(initialNote ?? (initialStatus === "paid" ? "cash" : ""))
    } else {
      setPaymentStatus("paid")
      setPaymentStatusNote("cash")
    }
  }, [open, initialStatus, initialNote])

  async function save(status: "paid" | "waived" | null) {
    if (!registrationId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/event-registrations/${registrationId}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_status: status,
          payment_status_note:
            status === null ? null : paymentStatusNote.trim() || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error || "Failed to save")
      }
      toast.success(
        status === null
          ? "Payment override cleared"
          : status === "paid"
            ? "Marked paid"
            : "Marked waived",
      )
      onOpenChange(false)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const hasOverride = initialStatus === "paid" || initialStatus === "waived"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark payment for {personName}</DialogTitle>
          <DialogDescription>
            Record a payment settled outside of Stripe checkout.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <PaymentOverrideFields
            status={paymentStatus}
            onStatusChange={setPaymentStatus}
            note={paymentStatusNote}
            onNoteChange={setPaymentStatusNote}
            idPrefix="event-payment"
          />
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {hasOverride ? (
            <Button
              type="button"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
              disabled={saving}
              onClick={() => void save(null)}
            >
              Clear override
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void save(paymentStatus)}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
