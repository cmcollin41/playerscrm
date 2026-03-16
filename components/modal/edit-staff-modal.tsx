"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ImageDropzone } from "@/components/ui/image-dropzone"

interface EditStaffModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staffId: string
  personName: string
  currentPhoto?: string | null
  accountId: string
  onRefresh?: () => void | Promise<void>
}

export function EditStaffModal({
  open,
  onOpenChange,
  staffId,
  personName,
  currentPhoto,
  accountId,
  onRefresh,
}: EditStaffModalProps) {
  const { refresh } = useRouter()
  const supabase = createClient()
  const [photo, setPhoto] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setPhoto(currentPhoto || "")
    }
  }, [open, currentPhoto])

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from("staff")
        .update({ photo: photo || null })
        .eq("id", staffId)

      if (error) throw error

      toast.success("Staff photo updated")
      onOpenChange(false)
      onRefresh?.() ?? refresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to update")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit Staff — {personName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <ImageDropzone
              value={photo || null}
              onChange={(v) => setPhoto(v ?? "")}
              onFileSelect={async (file) => {
                const ext = file.name.split(".").pop()
                const fileName = `staff/${accountId}/${crypto.randomUUID()}.${ext}`
                const { data, error } = await supabase.storage
                  .from("headshots")
                  .upload(fileName, file, { upsert: true })
                if (error) throw error
                const { data: urlData } = supabase.storage.from("headshots").getPublicUrl(data.path)
                toast.success("Image uploaded")
                return urlData.publicUrl
              }}
              onError={(msg) => toast.error(msg)}
              placeholder="Drop image or click to upload"
            />
            <p className="text-xs text-muted-foreground">Overrides person photo for this team</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
