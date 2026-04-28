"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ImageDropzone } from "@/components/ui/image-dropzone"
import { toast } from "sonner"
import LoadingDots from "@/components/icons/loading-dots"

function toLocalInput(value: string | null): string {
  if (!value) return ""
  const d = new Date(value)
  if (isNaN(d.getTime())) return ""
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
}

export function EventEditClient({ event }: { event: any }) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState(event.name || "")
  const [description, setDescription] = useState(event.description || "")
  const [location, setLocation] = useState(event.location || "")
  const [startsAt, setStartsAt] = useState(toLocalInput(event.starts_at))
  const [endsAt, setEndsAt] = useState(toLocalInput(event.ends_at))
  const [registrationOpensAt, setRegistrationOpensAt] = useState(
    toLocalInput(event.registration_opens_at)
  )
  const [registrationClosesAt, setRegistrationClosesAt] = useState(
    toLocalInput(event.registration_closes_at)
  )
  const [capacity, setCapacity] = useState(event.capacity?.toString() || "")
  const [feeAmount, setFeeAmount] = useState(
    event.fee_amount ? (event.fee_amount / 100).toFixed(2) : ""
  )
  const [feeDescription, setFeeDescription] = useState(event.fee_description || "")
  const [isPublished, setIsPublished] = useState(!!event.is_published)
  const [imageUrl, setImageUrl] = useState<string | null>(event.image_url || null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Event name is required")
      return
    }

    setSaving(true)
    try {
      const feeInCents = feeAmount ? Math.round(parseFloat(feeAmount) * 100) : 0

      const { error } = await supabase
        .from("events")
        .update({
          name: name.trim(),
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
          image_url: imageUrl,
        })
        .eq("id", event.id)

      if (error) throw error

      toast.success("Event updated")
      router.push(`/events/${event.id}`)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to update event")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Edit Event</h1>

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
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Cover Image</Label>
              <ImageDropzone
                value={imageUrl}
                onChange={setImageUrl}
                onFileSelect={async (file) => {
                  const ext = file.name.split(".").pop()
                  const fileName = `${event.account_id}/${crypto.randomUUID()}.${ext}`
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
                placeholder="Drop a cover image (JPG, PNG, WebP — max 50MB)"
                className="min-h-32"
                maxSize={50 * 1024 * 1024}
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
            {saving ? <LoadingDots color="#fff" /> : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}
