"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ExternalLink,
  MoreHorizontal,
  CheckCircle2,
  Ban,
  Clock,
  UserMinus,
  Trash2,
  Receipt,
  Loader2,
  Send,
  DollarSign,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
import { postEventInvoice } from "@/lib/post-event-invoice"
import { EventRegistrationPaymentModal } from "@/components/modal/event-registration-payment-modal"

interface Registration {
  id: string
  status: string
  created_at: string
  people: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    grade: string | null
    dependent: boolean | null
  } | null
  payments: {
    status: string | null
    amount: number | null
  } | null
  payment_status: "paid" | "waived" | null
  payment_status_note: string | null
  guardian_email: string | null
  guardian_person_id: string | null
}

interface EventDetailClientProps {
  event: any
  registrations: Registration[]
}

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  cancelled: "bg-red-100 text-red-800",
  waitlisted: "bg-blue-100 text-blue-800",
}

export function EventDetailClient({ event, registrations }: EventDetailClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [invoiceTarget, setInvoiceTarget] = useState<
    | { mode: "single"; reg: Registration }
    | { mode: "bulk"; regs: Registration[] }
    | null
  >(null)
  const [paymentTarget, setPaymentTarget] = useState<Registration | null>(null)

  const stripeAccountId: string | null = event.accounts?.stripe_id ?? null
  const accountId: string = event.account_id

  const isPaid = (reg: Registration) =>
    reg.payment_status === "paid" || reg.payments?.status === "succeeded"

  const eligibleForInvoice = (reg: Registration) =>
    reg.status === "pending" && !isPaid(reg) && reg.payment_status !== "waived"

  const pendingForBulk = registrations.filter((r) => {
    if (!eligibleForInvoice(r)) return false
    const email = r.people?.email || r.guardian_email
    return !!email
  })

  async function updateStatus(regId: string, status: string) {
    setPendingId(regId)
    const { error } = await supabase
      .from("event_registrations")
      .update({ status })
      .eq("id", regId)
    setPendingId(null)

    if (error) {
      toast.error(error.message || "Failed to update")
      return
    }
    toast.success(`Marked ${status}`)
    router.refresh()
  }

  async function removeRegistration(regId: string) {
    setPendingId(regId)
    const { error } = await supabase
      .from("event_registrations")
      .delete()
      .eq("id", regId)
    setPendingId(null)
    setConfirmRemoveId(null)

    if (error) {
      toast.error(error.message || "Failed to remove")
      return
    }
    toast.success("Registration removed")
    router.refresh()
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Registrations ({registrations.length})</CardTitle>
            <CardDescription>
              Manage who has registered. Pending = awaiting Stripe payment
              confirmation; you can mark them Confirmed manually if needed.
            </CardDescription>
          </div>
          {pendingForBulk.length > 0 && stripeAccountId && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-green-700 border-green-200 bg-green-50/50 hover:bg-green-50"
              onClick={() =>
                setInvoiceTarget({ mode: "bulk", regs: pendingForBulk })
              }
            >
              <Send className="mr-2 h-4 w-4" />
              Invoice {pendingForBulk.length} pending
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {registrations.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No registrations yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Email</th>
                    <th className="pb-3 pr-4">Grade</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Payment</th>
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg) => {
                    const displayEmail = reg.people?.email || reg.guardian_email
                    const isGuardianEmail = !reg.people?.email && !!reg.guardian_email
                    return (
                    <tr key={reg.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">
                        {reg.people?.id ? (
                          <Link
                            href={`/people/${reg.people.id}`}
                            className="hover:underline"
                          >
                            {reg.people.first_name} {reg.people.last_name}
                          </Link>
                        ) : (
                          <>
                            {reg.people?.first_name} {reg.people?.last_name}
                          </>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        {displayEmail ? (
                          <span>
                            {displayEmail}
                            {isGuardianEmail && (
                              <span className="ml-1.5 text-[10px] uppercase tracking-wide text-gray-400">
                                (parent)
                              </span>
                            )}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        {reg.people?.grade || "-"}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            STATUS_STYLE[reg.status] || "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {reg.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        {reg.payment_status === "paid" ? (
                          <span className="text-green-600">
                            Paid{reg.payment_status_note ? ` (${reg.payment_status_note})` : ""}
                          </span>
                        ) : reg.payment_status === "waived" ? (
                          <span className="text-violet-700">Waived</span>
                        ) : reg.payments?.status === "succeeded" ? (
                          <span className="text-green-600">Paid</span>
                        ) : reg.payments?.status ? (
                          <span className="capitalize">
                            {reg.payments.status.replace(/_/g, " ")}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        {new Date(reg.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-1">
                          {eligibleForInvoice(reg) && stripeAccountId && (reg.people?.email || reg.guardian_email) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 shrink-0 p-0 text-green-700 border-green-200 bg-green-50/50 hover:bg-green-50"
                              title="Send invoice"
                              onClick={() =>
                                setInvoiceTarget({ mode: "single", reg })
                              }
                            >
                              <Receipt className="h-4 w-4" />
                            </Button>
                          )}
                          <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={pendingId === reg.id}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {reg.status !== "confirmed" && (
                              <DropdownMenuItem
                                onClick={() => updateStatus(reg.id, "confirmed")}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                                Mark confirmed
                              </DropdownMenuItem>
                            )}
                            {reg.status !== "pending" && (
                              <DropdownMenuItem
                                onClick={() => updateStatus(reg.id, "pending")}
                              >
                                <Clock className="mr-2 h-4 w-4 text-amber-600" />
                                Mark pending
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setPaymentTarget(reg)}>
                              {reg.payment_status === "waived" ? (
                                <ShieldCheck className="mr-2 h-4 w-4 text-violet-600" />
                              ) : (
                                <DollarSign className="mr-2 h-4 w-4 text-green-600" />
                              )}
                              {reg.payment_status === "paid" || reg.payment_status === "waived"
                                ? "Edit payment"
                                : "Mark as paid"}
                            </DropdownMenuItem>
                            {reg.status !== "waitlisted" && (
                              <DropdownMenuItem
                                onClick={() => updateStatus(reg.id, "waitlisted")}
                              >
                                <UserMinus className="mr-2 h-4 w-4 text-blue-600" />
                                Move to waitlist
                              </DropdownMenuItem>
                            )}
                            {reg.status !== "cancelled" && (
                              <DropdownMenuItem
                                onClick={() => updateStatus(reg.id, "cancelled")}
                              >
                                <Ban className="mr-2 h-4 w-4 text-red-600" />
                                Cancel
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setConfirmRemoveId(reg.id)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!confirmRemoveId}
        onOpenChange={(open) => !open && setConfirmRemoveId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove registration?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the registration row. The person record is
              not affected. Prefer "Cancel" if you want to keep a record of the
              cancellation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRemoveId && removeRegistration(confirmRemoveId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SendEventInvoiceModal
        target={invoiceTarget}
        event={event}
        accountId={accountId}
        stripeAccountId={stripeAccountId}
        onClose={() => setInvoiceTarget(null)}
        onSent={() => {
          setInvoiceTarget(null)
          router.refresh()
        }}
      />

      <EventRegistrationPaymentModal
        open={!!paymentTarget}
        onOpenChange={(open) => {
          if (!open) setPaymentTarget(null)
        }}
        registrationId={paymentTarget?.id ?? null}
        personName={
          paymentTarget
            ? `${paymentTarget.people?.first_name ?? ""} ${paymentTarget.people?.last_name ?? ""}`.trim() ||
              "this registrant"
            : ""
        }
        initialStatus={paymentTarget?.payment_status ?? null}
        initialNote={paymentTarget?.payment_status_note ?? null}
      />
    </>
  )
}

interface SendEventInvoiceModalProps {
  target:
    | { mode: "single"; reg: Registration }
    | { mode: "bulk"; regs: Registration[] }
    | null
  event: any
  accountId: string
  stripeAccountId: string | null
  onClose: () => void
  onSent: () => void
}

function SendEventInvoiceModal({
  target,
  event,
  accountId,
  stripeAccountId,
  onClose,
  onSent,
}: SendEventInvoiceModalProps) {
  const defaultAmount = event.fee_amount ? (event.fee_amount / 100).toFixed(2) : ""
  const [amount, setAmount] = useState(defaultAmount)
  const [memo, setMemo] = useState("")
  const [sending, setSending] = useState(false)

  // Re-seed when target changes (modal reopens)
  const targetKey = target
    ? target.mode === "single"
      ? `s:${target.reg.id}`
      : `b:${target.regs.length}`
    : null
  const [seededKey, setSeededKey] = useState<string | null>(null)
  if (target && seededKey !== targetKey) {
    setAmount(defaultAmount)
    setMemo("")
    setSeededKey(targetKey)
  }
  if (!target && seededKey !== null) {
    setSeededKey(null)
  }

  async function sendOne(reg: Registration, amt: number, desc: string) {
    const email = reg.people?.email || reg.guardian_email
    if (!email) throw new Error(`No email for ${reg.people?.first_name ?? "registrant"}`)
    if (!reg.people?.id) throw new Error("Missing person id")
    if (!stripeAccountId) throw new Error("Stripe is not connected on this account")

    const athleteName = `${reg.people.first_name ?? ""} ${reg.people.last_name ?? ""}`.trim()

    // For dependents, the payer is the resolved guardian; otherwise the
    // registrant pays for themselves.
    const payerPersonId = reg.guardian_person_id || reg.people.id

    await postEventInvoice({
      eventRegistrationId: reg.id,
      eventId: event.id,
      eventName: event.name,
      athleteName: athleteName || "Registrant",
      amount: amt,
      recipientEmail: email,
      payerPersonId,
      description: desc || undefined,
      accountId,
      stripeAccountId,
      person_id: reg.people.id,
    })
  }

  async function handleSend() {
    if (!target) return
    const amt = Number.parseFloat(amount.trim())
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid invoice amount")
      return
    }
    if (!stripeAccountId) {
      toast.error("Connect Stripe on this account first")
      return
    }

    setSending(true)
    try {
      if (target.mode === "single") {
        await sendOne(target.reg, amt, memo.trim())
        toast.success("Invoice sent")
      } else {
        // Sequential to avoid duplicate Stripe customer creation when siblings
        // share a guardian (race in /api/stripe-customers on first send).
        let ok = 0
        let firstErr: Error | null = null
        for (const r of target.regs) {
          try {
            await sendOne(r, amt, memo.trim())
            ok++
          } catch (e) {
            if (!firstErr) firstErr = e instanceof Error ? e : new Error(String(e))
          }
        }
        const fail = target.regs.length - ok
        if (fail === 0) {
          toast.success(`Sent ${ok} invoice${ok === 1 ? "" : "s"}`)
        } else if (ok === 0) {
          toast.error(firstErr?.message || "All invoices failed")
        } else {
          toast.success(`Sent ${ok}, ${fail} failed`)
        }
      }
      onSent()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invoice failed")
    } finally {
      setSending(false)
    }
  }

  const isBulk = target?.mode === "bulk"
  const targetName =
    target?.mode === "single"
      ? `${target.reg.people?.first_name ?? ""} ${target.reg.people?.last_name ?? ""}`.trim()
      : null

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !sending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send invoice</DialogTitle>
          <DialogDescription>
            {isBulk
              ? `Sends a Stripe invoice to ${target!.regs.length} pending registrant${target!.regs.length === 1 ? "" : "s"}. When paid, each registration auto-flips to Confirmed.`
              : `Sends a Stripe invoice to ${targetName || "this registrant"}. When paid, the registration auto-flips to Confirmed.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="invoice_amount">Amount (USD)</Label>
            <Input
              id="invoice_amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={sending}
            />
            {event.fee_amount > 0 && (
              <p className="text-xs text-gray-500">
                Default is the event fee (${(event.fee_amount / 100).toFixed(2)}). Edit if you need a different amount.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice_memo">Memo (optional)</Label>
            <Textarea
              id="invoice_memo"
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder={
                target?.mode === "single"
                  ? `Invoice to complete registration for ${targetName || "registrant"} -- ${event.name}`
                  : `Invoice to complete registration for {registrant} -- ${event.name}`
              }
              disabled={sending}
            />
          </div>

          {isBulk && (
            <div className="rounded-md border bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <p className="font-medium text-gray-700">Recipients</p>
              <ul className="mt-1 space-y-0.5">
                {target!.regs.slice(0, 6).map((r) => {
                  const email = r.people?.email || r.guardian_email
                  const name = `${r.people?.first_name ?? ""} ${r.people?.last_name ?? ""}`.trim()
                  return (
                    <li key={r.id} className="truncate">
                      {name || "—"} · <span className="text-gray-500">{email}</span>
                    </li>
                  )
                })}
                {target!.regs.length > 6 && (
                  <li className="text-gray-500">+ {target!.regs.length - 6} more</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isBulk ? `Send ${target!.regs.length} invoices` : "Send invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ShareLinkBanner({ slug }: { slug: string }) {
  const url =
    typeof window !== "undefined" ? `${window.location.origin}/register/${slug}` : ""

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/register/${slug}`)
    toast.success("Registration link copied")
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <p className="flex-1 text-sm text-blue-800">
        Share this link with families to let them register:
      </p>
      <code className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-900">{url}</code>
      <Button size="sm" variant="outline" className="shrink-0" onClick={copyLink}>
        <ExternalLink className="mr-1 h-3 w-3" />
        Copy
      </Button>
    </div>
  )
}

export function DeleteEventButton({ eventId }: { eventId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    setBusy(true)
    const { error } = await supabase.from("events").delete().eq("id", eventId)
    setBusy(false)
    setOpen(false)

    if (error) {
      toast.error(error.message || "Failed to delete")
      return
    }
    toast.success("Event deleted")
    router.push("/events")
    router.refresh()
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-red-600 hover:text-red-700"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the event and all its registrations. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
