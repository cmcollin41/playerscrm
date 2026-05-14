"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAccount } from "@/lib/fetchers/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ImageDropzone } from "@/components/ui/image-dropzone"
import { toast } from "sonner"
import { slugify } from "@/lib/slug"
import LoadingDots from "@/components/icons/loading-dots"
import { RRule, Frequency, Weekday } from "rrule"

type EventType = "camp" | "game" | "other"
type RecurrenceFreq = "none" | "daily" | "weekly" | "monthly"

const MAX_OCCURRENCES = 52

const WEEKDAY_OPTIONS: { value: number; label: string; rrule: Weekday }[] = [
  { value: 0, label: "M", rrule: RRule.MO },
  { value: 1, label: "T", rrule: RRule.TU },
  { value: 2, label: "W", rrule: RRule.WE },
  { value: 3, label: "T", rrule: RRule.TH },
  { value: 4, label: "F", rrule: RRule.FR },
  { value: 5, label: "S", rrule: RRule.SA },
  { value: 6, label: "S", rrule: RRule.SU },
]

function localInputToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function expandRecurrence(opts: {
  freq: RecurrenceFreq
  startsAtIso: string
  count: number
  weekdays: number[]
}): Date[] {
  const start = new Date(opts.startsAtIso)
  if (opts.freq === "none") return [start]

  const baseRRule: { dtstart: Date; count: number; freq?: number; byweekday?: Weekday[] } = {
    dtstart: start,
    count: Math.min(Math.max(opts.count, 1), MAX_OCCURRENCES),
  }

  if (opts.freq === "daily") {
    baseRRule.freq = Frequency.DAILY
  } else if (opts.freq === "weekly") {
    baseRRule.freq = Frequency.WEEKLY
    if (opts.weekdays.length > 0) {
      baseRRule.byweekday = opts.weekdays.map(
        (i) => WEEKDAY_OPTIONS[i].rrule,
      )
    }
  } else if (opts.freq === "monthly") {
    baseRRule.freq = Frequency.MONTHLY
  }

  return new RRule(baseRRule).all()
}

const TYPE_OPTIONS: { value: EventType; label: string; description: string }[] = [
  {
    value: "camp",
    label: "Camp / Clinic",
    description: "Paid registration with capacity and registration window",
  },
  {
    value: "game",
    label: "Game",
    description: "Team game with opponent and home/away",
  },
  {
    value: "other",
    label: "Other",
    description: "Anything else — meetings, tournaments, fundraisers",
  },
]

interface Team {
  id: string
  name: string
  slug: string | null
}

export default function NewEventPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  const initialType = (searchParams.get("type") as EventType) || "camp"
  const initialTeam = searchParams.get("team") || ""

  const [eventType, setEventType] = useState<EventType>(
    TYPE_OPTIONS.some((t) => t.value === initialType) ? initialType : "camp",
  )
  const [teamId, setTeamId] = useState<string>(initialTeam)
  const [teams, setTeams] = useState<Team[]>([])

  // Common
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [arrivalAt, setArrivalAt] = useState("")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isPublished, setIsPublished] = useState(false)

  // Game-specific
  const [opponent, setOpponent] = useState("")
  const [isHome, setIsHome] = useState(true)

  // Recurrence
  const [recurrenceFreq, setRecurrenceFreq] = useState<RecurrenceFreq>("none")
  const [recurrenceCount, setRecurrenceCount] = useState("8")
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([])

  // Registration
  const [isRegisterable, setIsRegisterable] = useState(true)
  const [isPaid, setIsPaid] = useState(false)
  const [registrationOpensAt, setRegistrationOpensAt] = useState("")
  const [registrationClosesAt, setRegistrationClosesAt] = useState("")
  const [capacity, setCapacity] = useState("")
  const [feeAmount, setFeeAmount] = useState("")
  const [feeDescription, setFeeDescription] = useState("")

  useEffect(() => {
    supabase
      .from("teams")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setTeams(data || []))
  }, [supabase])

  // Sensible defaults per type (user can override either toggle).
  useEffect(() => {
    if (eventType === "game") {
      setIsPublished(true)
      setIsRegisterable(false)
      setIsPaid(false)
    } else if (eventType === "camp") {
      setIsPublished(false)
      setIsRegisterable(true)
      setIsPaid(true)
    } else {
      setIsPublished(false)
      setIsRegisterable(true)
      setIsPaid(false)
    }
  }, [eventType])

  const isGame = eventType === "game"
  const team = teams.find((t) => t.id === teamId) || null

  // When user picks Weekly recurrence, seed weekdays from the chosen start date.
  useEffect(() => {
    if (recurrenceFreq !== "weekly" || !startsAt || recurrenceWeekdays.length > 0)
      return
    const d = new Date(startsAt)
    if (isNaN(d.getTime())) return
    // JS getDay: 0=Sun..6=Sat. Convert to our Mon-first index (0=Mon..6=Sun).
    const idx = (d.getDay() + 6) % 7
    setRecurrenceWeekdays([idx])
  }, [recurrenceFreq, startsAt, recurrenceWeekdays.length])

  function toggleWeekday(idx: number) {
    setRecurrenceWeekdays((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort(),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isGame) {
      if (!teamId) {
        toast.error("Pick a team for the game")
        return
      }
      if (!opponent.trim()) {
        toast.error("Opponent is required")
        return
      }
      if (!startsAt) {
        toast.error("Start time is required")
        return
      }
    } else if (!name.trim()) {
      toast.error("Event name is required")
      return
    }

    setSaving(true)
    try {
      const account = await getAccount()
      if (!account?.id) throw new Error("No account found")

      let finalName: string
      let slug: string
      if (isGame) {
        const teamSlug = team?.slug || slugify(team?.name || "team")
        const opponentSlug = slugify(opponent)
        const date = new Date(startsAt)
        const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`
        slug = `game-${teamSlug}-vs-${opponentSlug}-${dateStr}`
        finalName = isHome ? `vs ${opponent.trim()}` : `@ ${opponent.trim()}`
      } else {
        finalName = name.trim()
        slug = slugify(finalName)
      }

      const feeInCents =
        isRegisterable && isPaid && feeAmount
          ? Math.round(parseFloat(feeAmount) * 100)
          : 0

      const insertRow: any = {
        account_id: account.id,
        team_id: teamId || null,
        event_type: eventType,
        name: finalName,
        slug,
        description: description.trim() || null,
        location: location.trim() || null,
        starts_at: localInputToIso(startsAt),
        ends_at: localInputToIso(endsAt),
        arrival_time: localInputToIso(arrivalAt),
        is_published: isPublished,
        is_registerable: isRegisterable,
        is_paid: isRegisterable && isPaid,
        fee_amount: feeInCents,
      }

      if (isGame) {
        insertRow.opponent_name = opponent.trim()
        insertRow.is_home = isHome
      } else {
        insertRow.image_url = imageUrl
      }

      if (isRegisterable) {
        insertRow.registration_opens_at = localInputToIso(registrationOpensAt)
        insertRow.registration_closes_at = localInputToIso(registrationClosesAt)
        insertRow.capacity = capacity ? parseInt(capacity) : null
        insertRow.fee_description = feeDescription.trim() || null
      }

      const recurring = !isGame && recurrenceFreq !== "none" && !!insertRow.starts_at
      if (recurring) {
        if (recurrenceFreq === "weekly" && recurrenceWeekdays.length === 0) {
          toast.error("Pick at least one day of the week")
          setSaving(false)
          return
        }
        const n = Math.min(
          Math.max(parseInt(recurrenceCount) || 1, 1),
          MAX_OCCURRENCES,
        )
        const dates = expandRecurrence({
          freq: recurrenceFreq,
          startsAtIso: insertRow.starts_at,
          count: n,
          weekdays: recurrenceWeekdays,
        })

        if (dates.length === 0) {
          toast.error("Recurrence produced no dates")
          setSaving(false)
          return
        }

        const seriesId = crypto.randomUUID()
        const durationMs = insertRow.ends_at
          ? new Date(insertRow.ends_at).getTime() -
            new Date(insertRow.starts_at).getTime()
          : null

        const rows = dates.map((startDate, i) => {
          const startIso = startDate.toISOString()
          const endIso =
            durationMs !== null
              ? new Date(startDate.getTime() + durationMs).toISOString()
              : null
          return {
            ...insertRow,
            slug: i === 0 ? slug : `${slug}-${i + 1}`,
            starts_at: startIso,
            ends_at: endIso,
            series_id: seriesId,
            series_index: i + 1,
          }
        })

        const { error } = await supabase.from("events").insert(rows)
        if (error) throw error

        toast.success(`Series created — ${rows.length} events`)
      } else {
        const { error } = await supabase.from("events").insert(insertRow)
        if (error) throw error

        toast.success(`${isGame ? "Game" : "Event"} created`)
      }

      router.push(teamId ? `/teams/${teamId}/schedule` : "/events")
    } catch (err: any) {
      toast.error(err.message || "Failed to create event")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">New Event</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Type</CardTitle>
            <CardDescription>What kind of event are you creating?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-3">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setEventType(t.value)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    eventType === t.value
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <p className="text-sm font-medium">{t.label}</p>
                  <p
                    className={`mt-0.5 text-xs ${
                      eventType === t.value ? "text-gray-300" : "text-gray-500"
                    }`}
                  >
                    {t.description}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team">
                Team {isGame ? <span className="text-red-500">*</span> : <span className="text-gray-400">(optional)</span>}
              </Label>
              <Select value={teamId || "__none__"} onValueChange={(v) => setTeamId(v === "__none__" ? "" : v)}>
                <SelectTrigger id="team">
                  <SelectValue placeholder="Account-level event (no team)" />
                </SelectTrigger>
                <SelectContent>
                  {!isGame && (
                    <SelectItem value="__none__">Account-level (no team)</SelectItem>
                  )}
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isGame ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="opponent">Opponent *</Label>
                  <Input
                    id="opponent"
                    placeholder="Lone Peak"
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">Home game</p>
                    <p className="text-xs text-gray-500">
                      {isHome ? "Played at our location" : "Played at the opponent's location"}
                    </p>
                  </div>
                  <Switch checked={isHome} onCheckedChange={setIsHome} />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="name">Event Name *</Label>
                <Input
                  id="name"
                  placeholder={
                    eventType === "camp"
                      ? "Bulldog Basketball Camp 2026"
                      : "Team meeting, tournament, etc."
                  }
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">{isGame ? "Notes" : "Description"}</Label>
              <Textarea
                id="description"
                placeholder={
                  isGame
                    ? "Region opener, white jerseys, etc."
                    : "A 3-day camp for youth athletes..."
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder={isHome && isGame ? "Main Gym" : "Provo High School Gym"}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {!isGame && (
              <div className="space-y-2">
                <Label>Cover Image</Label>
                <ImageDropzone
                  value={imageUrl}
                  onChange={setImageUrl}
                  onFileSelect={async (file) => {
                    const account = await getAccount()
                    if (!account?.id) throw new Error("No account found")
                    const ext = file.name.split(".").pop()
                    const fileName = `${account.id}/${crypto.randomUUID()}.${ext}`
                    const { data, error } = await supabase.storage
                      .from("event-images")
                      .upload(fileName, file, { upsert: false })
                    if (error) throw error
                    const { data: urlData } = supabase.storage
                      .from("event-images")
                      .getPublicUrl(data.path)
                    toast.success("Image uploaded")
                    return urlData.publicUrl
                  }}
                  onError={(msg) => toast.error(msg)}
                  placeholder="Drop a cover image (JPG, PNG, WebP — max 1GB)"
                  className="min-h-32"
                  maxSize={1024 * 1024 * 1024}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="starts_at">Starts {isGame && "*"}</Label>
                <Input
                  id="starts_at"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ends_at">Ends</Label>
                <Input
                  id="ends_at"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>
            {isGame && (
              <div className="space-y-2">
                <Label htmlFor="arrival">Arrival</Label>
                <Input
                  id="arrival"
                  type="datetime-local"
                  value={arrivalAt}
                  onChange={(e) => setArrivalAt(e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {!isGame && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recurrence</CardTitle>
              <CardDescription>
                Repeating events create one independent event per occurrence,
                so each can be edited later without affecting the others.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recurrence_freq">Repeats</Label>
                <Select
                  value={recurrenceFreq}
                  onValueChange={(v) => setRecurrenceFreq(v as RecurrenceFreq)}
                >
                  <SelectTrigger id="recurrence_freq">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Does not repeat</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recurrenceFreq === "weekly" && (
                <div className="space-y-2">
                  <Label>Days of the week</Label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleWeekday(i)}
                        className={`h-9 w-9 rounded-full border text-sm font-medium transition-colors ${
                          recurrenceWeekdays.includes(i)
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recurrenceFreq !== "none" && (
                <div className="space-y-2">
                  <Label htmlFor="recurrence_count">
                    Number of occurrences (max {MAX_OCCURRENCES})
                  </Label>
                  <Input
                    id="recurrence_count"
                    type="number"
                    min="1"
                    max={MAX_OCCURRENCES}
                    value={recurrenceCount}
                    onChange={(e) => setRecurrenceCount(e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Registration</CardTitle>
            <CardDescription>
              Turn on registration if people need to sign up to attend.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Registerable</p>
                <p className="text-xs text-gray-500">
                  Off for informational events with no signup
                </p>
              </div>
              <Switch checked={isRegisterable} onCheckedChange={setIsRegisterable} />
            </div>

            {isRegisterable && (
              <>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">Paid</p>
                    <p className="text-xs text-gray-500">
                      Charge a fee through Stripe at registration time
                    </p>
                  </div>
                  <Switch checked={isPaid} onCheckedChange={setIsPaid} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg_opens">Registration Opens</Label>
                    <Input
                      id="reg_opens"
                      type="datetime-local"
                      value={registrationOpensAt}
                      onChange={(e) => setRegistrationOpensAt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg_closes">Registration Closes</Label>
                    <Input
                      id="reg_closes"
                      type="datetime-local"
                      value={registrationClosesAt}
                      onChange={(e) => setRegistrationClosesAt(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {isPaid && (
                    <div className="space-y-2">
                      <Label htmlFor="fee">Fee ($)</Label>
                      <Input
                        id="fee"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={feeAmount}
                        onChange={(e) => setFeeAmount(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Max Capacity</Label>
                    <Input
                      id="capacity"
                      type="number"
                      min="1"
                      placeholder="Unlimited"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                    />
                  </div>
                </div>
                {isPaid && (
                  <div className="space-y-2">
                    <Label htmlFor="fee_desc">Fee Description</Label>
                    <Input
                      id="fee_desc"
                      placeholder="Includes camp t-shirt and lunch"
                      value={feeDescription}
                      onChange={(e) => setFeeDescription(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">Publish</p>
              <p className="text-xs text-gray-500">
                {isGame
                  ? "Published games appear on the team's public schedule."
                  : "Published events get a registration link anyone can use."}
              </p>
            </div>
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <LoadingDots color="#fff" /> : `Create ${isGame ? "Game" : "Event"}`}
          </Button>
        </div>
      </form>
    </div>
  )
}
