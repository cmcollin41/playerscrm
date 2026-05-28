import { Button } from "@/components/ui/button"
import { FileText, Receipt } from "lucide-react"
import {
  getPaymentEvidenceUrl,
  type PaidEntityLike,
} from "@/lib/payments/status"

interface InvoiceReceiptButtonProps {
  entity: PaidEntityLike
  /** Tailwind size class shortcut. "sm" matches the dashboard row buttons. */
  size?: "sm" | "default"
  className?: string
  /** Rendered when there's no invoice or payment to link to. */
  emptyFallback?: React.ReactNode
}

/**
 * Renders either a "Receipt" or "Invoice" outline button linked to the right
 * Stripe-hosted URL. Decision lives in lib/payments/status.ts so the dashboard,
 * portal, and any future surface stay consistent.
 */
export function InvoiceReceiptButton({
  entity,
  size = "sm",
  className,
  emptyFallback = <span className="text-xs text-gray-400">—</span>,
}: InvoiceReceiptButtonProps) {
  const evidence = getPaymentEvidenceUrl(entity)
  if (!evidence) return <>{emptyFallback}</>

  const Icon = evidence.kind === "receipt" ? Receipt : FileText
  const label = evidence.kind === "receipt" ? "Receipt" : "Invoice"

  return (
    <Button
      asChild
      variant="outline"
      size={size}
      className={size === "sm" ? `h-7 text-xs ${className ?? ""}` : className}
    >
      <a href={evidence.url} target="_blank" rel="noopener noreferrer">
        <Icon className="mr-1 h-3 w-3" /> {label}
      </a>
    </Button>
  )
}
