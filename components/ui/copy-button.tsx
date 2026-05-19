"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CopyButtonProps {
  value: string
  label?: string
  /** Toast text when the copy succeeds. Defaults to "Copied". */
  successText?: string
  /** Inline label rendered next to the icon. Omit for icon-only. */
  children?: React.ReactNode
  className?: string
  size?: "default" | "sm" | "icon"
  variant?:
    | "default"
    | "outline"
    | "ghost"
    | "secondary"
    | "destructive"
    | "link"
  disabled?: boolean
}

export function CopyButton({
  value,
  label,
  successText,
  children,
  className,
  size = "sm",
  variant = "outline",
  disabled,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(successText ?? (label ? `${label} copied` : "Copied"))
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Copy failed — copy the link manually")
    }
  }

  const Icon = copied ? Check : Copy
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      onClick={handleCopy}
      className={cn(className)}
      aria-label={label ? `Copy ${label}` : "Copy link"}
      title={label ? `Copy ${label}` : "Copy link"}
    >
      <Icon className={cn("h-3.5 w-3.5", children != null && "mr-1")} />
      {children}
    </Button>
  )
}
