"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAccount } from "@/lib/fetchers/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { slugify } from "@/lib/slug"
import LoadingDots from "@/components/icons/loading-dots"

export default function NewEventPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [registrationOpensAt, setRegistrationOpensAt] = useState("")
  const [registrationClosesAt, setRegistrationClosesAt] = useState("")
  const [capacity, setCapacity] = useState("")
  const [feeAmount, setFeeAmount] = useState("")
  const [feeDescription, setFeeDescription] = useState("")
  const [isPublished, setIsPublished] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Event name is required")
      return
    }

    setSaving(true)
    try {
      const account = await getAccount()
      if (!account?.id) throw new Error("No account found")

      const slug = slugify(name)
      const feeInCents = feeAmount ? Math.round(parseFloat(feeAmount) * 100) : 0

      const { error } = await supabase.from("events").insert({
        account_id: account.id,
        name: name.trim(),
        slug,
        description: description.trim() || null,
        location: location.trim() || null,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        registration_opens_at: registrationOpensAt || null,
        registration_closes_at: registrationClosesAt || null,
        capacity: capacity ? parseInt(capacity) : null,
        fee_amount: feeInCents,
        fee_description: feeDescription.trim() || null,
        is_published: isPublished,
      })

      if (error) throw error

      toast.success("Event created")
      router.push("/events")
    } catch (err: any) {
      toast.error(err.message || "Failed to create event")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-3xl font-bold tracking-tight mb-6">New Event</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Event Name *</Label>
              <Input
                id="name"
                placeholder="Bulldog Basketball Camp 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="A 3-day camp for youth athletes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="Provo High School Gym"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="starts_at">Starts</Label>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Registration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="fee_desc">Fee Description</Label>
              <Input
                id="fee_desc"
                placeholder="Includes camp t-shirt and lunch"
                value={feeDescription}
                onChange={(e) => setFeeDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Publish Event</p>
                <p className="text-xs text-gray-500">
                  When published, anyone with the link can view and register
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
            {saving ? <LoadingDots color="#fff" /> : "Create Event"}
          </Button>
        </div>
      </form>
    </div>
  )
}
