"use client"

import { useState } from "react"
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
  ExternalLink,
  MoreHorizontal,
  CheckCircle2,
  Ban,
  Clock,
  UserMinus,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

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
  } | null
  payments: {
    status: string | null
    amount: number | null
  } | null
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

  const copyLink = () => {
    const url = `${window.location.origin}/register/${event.slug}`
    navigator.clipboard.writeText(url)
    toast.success("Registration link copied")
  }

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
      {event.is_published && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="flex-1 text-sm text-blue-800">
            Share this link with families to let them register:
          </p>
          <code className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-900">
            {typeof window !== "undefined" ? window.location.origin : ""}/register/{event.slug}
          </code>
          <Button size="sm" variant="outline" className="shrink-0" onClick={copyLink}>
            <ExternalLink className="mr-1 h-3 w-3" />
            Copy
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Registrations ({registrations.length})</CardTitle>
          <CardDescription>
            Manage who has registered. Pending = awaiting Stripe payment
            confirmation; you can mark them Confirmed manually if needed.
          </CardDescription>
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
                  {registrations.map((reg) => (
                    <tr key={reg.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">
                        {reg.people?.first_name} {reg.people?.last_name}
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        {reg.people?.email || "-"}
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
                        {reg.payments?.status === "succeeded" ? (
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
                      </td>
                    </tr>
                  ))}
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
    </>
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
