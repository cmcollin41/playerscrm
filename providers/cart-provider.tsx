"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"

export interface CartLine {
  variantId: string
  productId: string
  productSlug: string
  productName: string
  variantSku: string
  options: Record<string, string>
  priceCents: number
  imageUrl: string | null
  connectionId: string
  partnerSlug: string
  quantity: number
}

interface CartContextValue {
  lines: CartLine[]
  itemCount: number
  subtotalCents: number
  hydrated: boolean
  isOpen: boolean
  setOpen: (open: boolean) => void
  openCart: () => void
  closeCart: () => void
  addLine: (line: Omit<CartLine, "quantity"> & { quantity?: number }) => void
  setQuantity: (variantId: string, quantity: number) => void
  removeLine: (variantId: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = "athletes_store_cart_v1"
const MAX_QTY = 50

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setLines(parsed as CartLine[])
      }
    } catch {
      // localStorage unavailable / corrupted — start empty.
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      // Quota exceeded or disabled — silent.
    }
  }, [lines, hydrated])

  const addLine = useCallback(
    (line: Omit<CartLine, "quantity"> & { quantity?: number }) => {
      const qty = Math.max(1, Math.min(MAX_QTY, line.quantity ?? 1))
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.variantId === line.variantId)
        if (idx >= 0) {
          const next = [...prev]
          const merged = Math.min(MAX_QTY, next[idx].quantity + qty)
          next[idx] = { ...next[idx], quantity: merged }
          return next
        }
        const { quantity: _ignored, ...rest } = line
        return [...prev, { ...rest, quantity: qty }]
      })
    },
    [],
  )

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setLines((prev) =>
      prev
        .map((l) =>
          l.variantId === variantId
            ? { ...l, quantity: Math.max(0, Math.min(MAX_QTY, quantity)) }
            : l,
        )
        .filter((l) => l.quantity > 0),
    )
  }, [])

  const removeLine = useCallback((variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  const itemCount = lines.reduce((s, l) => s + l.quantity, 0)
  const subtotalCents = lines.reduce(
    (s, l) => s + l.priceCents * l.quantity,
    0,
  )

  return (
    <CartContext.Provider
      value={{
        lines,
        itemCount,
        subtotalCents,
        hydrated,
        isOpen,
        setOpen: setIsOpen,
        openCart,
        closeCart,
        addLine,
        setQuantity,
        removeLine,
        clear,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within <CartProvider>")
  return ctx
}
