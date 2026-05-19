"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { publishFromPartner } from "../../actions"

interface PublishFromPartnerButtonProps {
  connectionId: string
  externalProductId: string
  alreadyPublished: boolean
}

export function PublishFromPartnerButton({
  connectionId,
  externalProductId,
  alreadyPublished,
}: PublishFromPartnerButtonProps) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await publishFromPartner({
        connectionId,
        externalProductId,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        alreadyPublished
          ? "Re-synced from partner."
          : "Published to your storefront.",
      )
    })
  }

  return (
    <Button
      size="sm"
      variant={alreadyPublished ? "outline" : "default"}
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          {alreadyPublished ? "Syncing…" : "Publishing…"}
        </>
      ) : alreadyPublished ? (
        "Resync"
      ) : (
        "Publish"
      )}
    </Button>
  )
}
