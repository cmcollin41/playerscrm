"use client"

import { use, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { getAccount } from "@/lib/fetchers/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { slugify } from "@/lib/slug"
import LoadingDots from "@/components/icons/loading-dots"

const WEEKDAYS = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
  { value: 0, short: "Sun", long: "Sunday" },
]

interface PracticeRow {
  startsAt: Date
  endsAt: Date | null
  arrival: Date | null
}

// Build a Date from a yyyy-mm-dd string and an HH:mm time string in local time
function combine(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  const [hh, mm] = timeStr.split(":").map(Number)
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0)
}

function generatePractices(
  startDate: string,
  endDate: string,
  weekdays: number[],
  startTime: string,
  endTime: string,
  arrivalTime: string,
): PracticeRow[] {
  if (!startDate || !endDate || !startTime || weekdays.length === 0) return []
  const start = new Date(startDate + "T00:00:00")
  const end = new Date(endDate + "T00:00:00")
  if (start > end) return []

  const rows: PracticeRow[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    if (weekdays.includes(cursor.getDay())) {
      const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`
      rows.push({
        startsAt: combine(dateStr, startTime),
        endsAt: endTime ? combine(dateStr, endTime) : null,
        arrival: arrivalTime ? combine(dateStr, arrivalTime) : null,
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return rows
}

export default function NewPracticePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [team, setTeam] = useState<{ id: string; name: string; slug: string | null } | null>(null)
  const [saving, setSaving] = useState(false)

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [startTime, setStartTime] = useState("16:00")
  const [endTime, setEndTime] = useState("18:00")
  const [arrivalTime, setArrivalTime] = useState("")
  const [location, setLocation] = useState("")
  const [name, setName] = useState("Practice")

  useEffect(() => {
    supabase
      .from("teams")
      .select("id, name, slug")
      .eq("id", id)
      .single()
      .then(({ data }) => setTeam(data))
  }, [id, supabase])

  const preview = useMemo(
    () => generatePractices(startDate, endDate, weekdays, startTime, endTime, arrivalTime),
    [startDate, endDate, weekdays, startTime, endTime, arrivalTime],
  )

  const toggleWeekday = (day: number) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (preview.length === 0) {
      toast.error("Pick a date range, weekdays, and start time")
      return
    }

    setSaving(true)
    try {
      const account = await getAccount()
      if (!account?.id) throw new Error("No account found")

      const teamSlug = team?.slug || slugify(team?.name || "team")
      const baseName = name.trim() || "Practice"

      const rows = preview.map((row) => {
        const d = row.startsAt
        const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
        const timeStr = `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`
        return {
          account_id: account.id,
          team_id: id,
          event_type: "practice" as const,
          name: baseName,
          slug: `practice-${teamSlug}-${dateStr}-${timeStr}`,
          location: location.trim() || null,
          starts_at: row.startsAt.toISOString(),
          ends_at: row.endsAt ? row.endsAt.toISOString() : null,
          arrival_time: row.arrival ? row.arrival.toISOString() : null,
          is_published: true,
        }
      })

      const { error } = await supabase.from("events").insert(rows)
      if (error) throw error

      toast.success(`Created ${rows.length} practice${rows.length === 1 ? "" : "s"}`)
      router.push(`/teams/${id}/schedule`)
    } catch (err: any) {
      toast.error(err.message || "Failed to create practices")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link
        href={`/teams/${id}/schedule`}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gray-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to schedule
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Add Practices</h1>
      <p className="text-muted-foreground">
        Bulk-create practice instances for {team?.name || "this team"} across a
        date range.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pattern</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Days of week</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleWeekday(d.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      weekdays.includes(d.value)
                        ? "bg-gray-900 text-white"
                        : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {d.short}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Start time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">End time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="arrival_time">Arrival</Label>
                <Input
                  id="arrival_time"
                  type="time"
                  placeholder="Optional"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Label</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Practice"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Main Gym"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Preview ({preview.length} practice
              {preview.length === 1 ? "" : "s"})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {preview.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Pick a date range, weekdays, and start time to preview.
              </p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-auto text-sm">
                {preview.slice(0, 50).map((row, i) => (
                  <li key={i} className="text-gray-700">
                    {row.startsAt.toLocaleString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {row.endsAt && (
                      <>
                        {" – "}
                        {row.endsAt.toLocaleTimeString([], { timeStyle: "short" })}
                      </>
                    )}
                  </li>
                ))}
                {preview.length > 50 && (
                  <li className="text-xs text-muted-foreground">
                    …and {preview.length - 50} more
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving || preview.length === 0}>
            {saving ? (
              <LoadingDots color="#fff" />
            ) : (
              `Create ${preview.length || ""} practice${preview.length === 1 ? "" : "s"}`
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
