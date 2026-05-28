"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type PaymentOverrideStatus = "paid" | "waived"

interface PaymentOverrideFieldsProps {
  status: PaymentOverrideStatus
  onStatusChange: (s: PaymentOverrideStatus) => void
  note: string
  onNoteChange: (n: string) => void
  /** Prefix for input ids so multiple instances can coexist on a page. */
  idPrefix?: string
}

/**
 * Shared "Mark paid / Mark waived" form fields used by the event registration
 * payment modal and the roster billing Status tab. Each surface owns its own
 * outer Dialog + submit endpoint; this component only owns the inner inputs
 * so the option list and conditional rendering stays consistent.
 */
export function PaymentOverrideFields({
  status,
  onStatusChange,
  note,
  onNoteChange,
  idPrefix = "payment",
}: PaymentOverrideFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-status`}>Status</Label>
        <Select
          value={status}
          onValueChange={(v) => onStatusChange(v as PaymentOverrideStatus)}
        >
          <SelectTrigger id={`${idPrefix}-status`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="waived">Waived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {status === "paid" && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-method`}>Payment method</Label>
          <Select value={note || "cash"} onValueChange={onNoteChange}>
            <SelectTrigger id={`${idPrefix}-method`}>
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

      {status === "waived" && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-reason`}>Reason (optional)</Label>
          <Input
            id={`${idPrefix}-reason`}
            placeholder="e.g. scholarship, coach's family"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
          />
        </div>
      )}
    </>
  )
}
