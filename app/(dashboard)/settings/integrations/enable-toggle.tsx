"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { setIntegrationEnabled } from "./actions"

interface EnableToggleProps {
  accountId: string
  slug: string
  name: string
  initialEnabled: boolean
}

export function EnableToggle({
  accountId,
  slug,
  name,
  initialEnabled,
}: EnableToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, startTransition] = useTransition()

  function onCheckedChange(next: boolean) {
    setEnabled(next)
    startTransition(async () => {
      const result = await setIntegrationEnabled({
        accountId,
        slug,
        enabled: next,
      })
      if (!result.ok) {
        toast.error(result.error ?? `Could not update ${name}.`)
        setEnabled(!next)
        return
      }
      toast.success(`${name} ${next ? "enabled" : "disabled"}.`)
    })
  }

  return (
    <Switch
      checked={enabled}
      onCheckedChange={onCheckedChange}
      disabled={pending}
      aria-label={`${enabled ? "Disable" : "Enable"} ${name}`}
    />
  )
}
