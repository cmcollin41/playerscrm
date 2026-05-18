"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ProductBuyPanelProps {
  productId: string
  productName: string
  sizes: string[]
}

export function ProductBuyPanel({
  productId,
  productName,
  sizes,
}: ProductBuyPanelProps) {
  const [size, setSize] = useState<string>(sizes[0] ?? "")
  const [quantity, setQuantity] = useState<number>(1)

  function handleBuy() {
    // Slice 4 will replace this with a POST to /api/checkout/store that
    // creates a Stripe Connect Checkout Session and redirects to it.
    toast(
      `Checkout for "${productName}" is coming online soon (Slice 4 wires Stripe).`,
      { description: `Selected: qty ${quantity}${size ? `, size ${size}` : ""}` },
    )
    // Reference productId so it isn't flagged as unused; checkout will need it.
    if (!productId) return
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="grid grid-cols-2 gap-3">
        {sizes.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">Size</Label>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sizes.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium">Quantity</Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={quantity}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10)
              if (Number.isFinite(n) && n >= 1) setQuantity(Math.min(n, 50))
            }}
          />
        </div>
      </div>
      <Button size="lg" onClick={handleBuy} className="w-full">
        <ShoppingBag className="mr-2 h-4 w-4" />
        Buy now
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Made-to-order. Free returns on unused items.
      </p>
    </div>
  )
}
