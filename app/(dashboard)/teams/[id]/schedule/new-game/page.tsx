"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { getAccount } from "@/lib/fetchers/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { slugify } from "@/lib/slug"
import LoadingDots from "@/components/icons/loading-dots"

export default function NewGamePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [team, setTeam] = useState<{ id: string; name: string; slug: string | null } | null>(null)
  const [saving, setSaving] = useState(false)

  const [opponent, setOpponent] = useState("")
  const [isHome, setIsHome] = useState(true)
  const [startsAt, setStartsAt] = useState("")
  const [arrivalAt, setArrivalAt] = useState("")
  const [location, setLocation] = useState("")
  const [description, setDescription] = useState("")
  const [isPublished, setIsPublished] = useState(true)

  useEffect(() => {
    supabase
      .from("teams")
      .select("id, name, slug")
      .eq("id", id)
      .single()
      .then(({ data }) => setTeam(data))
  }, [id, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!opponent.trim()) {
      toast.error("Opponent is required")
      return
    }
    if (!startsAt) {
      toast.error("Start time is required")
      return
    }

    setSaving(true)
    try {
      const account = await getAccount()
      if (!account?.id) throw new Error("No account found")

      const teamSlug = team?.slug || slugify(team?.name || "team")
      const opponentSlug = slugify(opponent)
      const date = new Date(startsAt)
      const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`
      const slug = `game-${teamSlug}-vs-${opponentSlug}-${dateStr}`
      const name = isHome ? `vs ${opponent.trim()}` : `@ ${opponent.trim()}`

      const { error } = await supabase.from("events").insert({
        account_id: account.id,
        team_id: id,
        event_type: "game",
        name,
        slug,
        description: description.trim() || null,
        location: location.trim() || null,
        starts_at: startsAt,
        arrival_time: arrivalAt || null,
        opponent_name: opponent.trim(),
        is_home: isHome,
        is_published: isPublished,
      })

      if (error) throw error

      toast.success("Game added to schedule")
      router.push(`/teams/${id}/schedule`)
    } catch (err: any) {
      toast.error(err.message || "Failed to add game")
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
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Add Game</h1>
      <p className="text-muted-foreground">
        Schedule a game for {team?.name || "this team"}.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Matchup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">When &amp; where</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="starts_at">Start *</Label>
                <Input
                  id="starts_at"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="arrival">Arrival</Label>
                <Input
                  id="arrival"
                  type="datetime-local"
                  value={arrivalAt}
                  onChange={(e) => setArrivalAt(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder={isHome ? "Main Gym" : "Lone Peak HS"}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Notes</Label>
              <Textarea
                id="description"
                placeholder="Region opener, white jerseys, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Publish</p>
                <p className="text-xs text-gray-500">
                  When published, the game appears on the team&apos;s public schedule.
                </p>
              </div>
              <Switch checked={isPublished} onCheckedChange={setIsPublished} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <LoadingDots color="#fff" /> : "Add Game"}
          </Button>
        </div>
      </form>
    </div>
  )
}
