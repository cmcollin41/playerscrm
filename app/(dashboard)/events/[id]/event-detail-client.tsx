"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
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

export function EventDetailClient({ event, registrations }: EventDetailClientProps) {
  const copyLink = () => {
    const url = `${window.location.origin}/register/${event.slug}`
    navigator.clipboard.writeText(url)
    toast.success("Registration link copied")
  }

  const statusColor: Record<string, string> = {
    confirmed: "bg-green-100 text-green-800",
    pending: "bg-amber-100 text-amber-800",
    cancelled: "bg-red-100 text-red-800",
    waitlisted: "bg-blue-100 text-blue-800",
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
          <CardDescription>People registered for this event</CardDescription>
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
                    <th className="pb-3">Date</th>
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
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor[reg.status] || "bg-gray-100 text-gray-800"}`}>
                          {reg.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        {reg.payments?.status === "succeeded" ? (
                          <span className="text-green-600">Paid</span>
                        ) : reg.payments?.status ? (
                          reg.payments.status
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 text-gray-500">
                        {new Date(reg.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
