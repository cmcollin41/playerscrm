"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ackAllPublishedToPartners } from "./actions"

export function AckPublishButton() {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const res = await ackAllPublishedToPartners()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      const { succeeded, failed, skipped, webhooksRegistered } = res
      if (
        succeeded === 0 &&
        failed === 0 &&
        skipped === 0 &&
        webhooksRegistered === 0
      ) {
        toast.success("Nothing to sync")
        return
      }
      const parts: string[] = []
      if (succeeded > 0) parts.push(`${succeeded} acked`)
      if (webhooksRegistered > 0)
        parts.push(`${webhooksRegistered} webhook${webhooksRegistered === 1 ? "" : "s"}`)
      if (failed > 0) parts.push(`${failed} failed`)
      if (skipped > 0) parts.push(`${skipped} skipped`)
      const summary = parts.join(" · ") || "Synced"
      if (failed > 0) toast.error(summary)
      else toast.success(summary)
    })
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={pending}
    >
      {pending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
      Resync to partners
    </Button>
  )
}
