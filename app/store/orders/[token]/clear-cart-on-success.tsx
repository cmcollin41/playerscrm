"use client"

import { useEffect } from "react"
import { useCart } from "@/providers/cart-provider"

export function ClearCartOnSuccess({ paid }: { paid: boolean }) {
  const { clear, hydrated } = useCart()
  useEffect(() => {
    if (paid && hydrated) clear()
  }, [paid, hydrated, clear])
  return null
}
