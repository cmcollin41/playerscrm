"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { refreshIntegrationWebhooks } from "./actions"

interface RefreshWebhooksButtonProps {
  accountId: string
  slug: string
  name: string
}

export function RefreshWebhooksButton({
  accountId,
  slug,
  name,
}: RefreshWebhooksButtonProps) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await refreshIntegrationWebhooks({ accountId, slug })
      if (!result.ok) {
        toast.error(result.error ?? "Could not refresh webhooks.")
        return
      }
      toast.success(`Refreshed ${name} webhooks.`)
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
      {pending ? (
        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="mr-1 h-3.5 w-3.5" />
      )}
      Refresh
    </Button>
  )
}
