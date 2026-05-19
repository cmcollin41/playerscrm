"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { setProductStatus } from "./actions"
import type { OrgProductStatus } from "@/types/schema.types"

export function PublishButton({
  productId,
  status,
  size = "sm",
  variant = "ghost",
}: {
  productId: string
  status: OrgProductStatus
  size?: "default" | "sm" | "icon"
  variant?: "default" | "outline" | "ghost" | "secondary"
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const next: OrgProductStatus = status === "active" ? "draft" : "active"
  const label =
    status === "active"
      ? "Unpublish"
      : status === "archived"
        ? "Republish"
        : "Publish"

  function handleClick() {
    startTransition(async () => {
      const res = await setProductStatus(productId, next)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(next === "active" ? "Product published" : "Product unpublished")
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handleClick}
      disabled={pending}
    >
      {pending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
      {label}
    </Button>
  )
}
