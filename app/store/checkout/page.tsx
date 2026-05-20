"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { loadStripe, type Stripe } from "@stripe/stripe-js"
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js"
import { ArrowLeft, Loader2, ShoppingBag } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCart, type CartLine } from "@/providers/cart-provider"

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

interface AddressForm {
  email: string
  name: string
  phone: string
  address1: string
  address2: string
  city: string
  region: string
  postalCode: string
  country: string
}

const DEFAULT_FORM: AddressForm = {
  email: "",
  name: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "US",
}

function isFormComplete(f: AddressForm): boolean {
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) &&
    f.name.trim().length > 0 &&
    f.address1.trim().length > 0 &&
    f.city.trim().length > 0 &&
    f.postalCode.trim().length > 0 &&
    f.country.trim().length === 2
  )
}

function toShippingAddress(f: AddressForm) {
  return {
    name: f.name.trim(),
    email: f.email.trim().toLowerCase(),
    phone: f.phone.trim() || undefined,
    address1: f.address1.trim(),
    address2: f.address2.trim() || undefined,
    city: f.city.trim(),
    region: f.region.trim() || undefined,
    postalCode: f.postalCode.trim(),
    country: f.country.trim().toUpperCase(),
  }
}

export default function CheckoutPage() {
  const router = useRouter()
  const { lines, hydrated, subtotalCents } = useCart()
  const [form, setForm] = useState<AddressForm>(DEFAULT_FORM)
  const [shippingCents, setShippingCents] = useState<number | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [paymentSession, setPaymentSession] = useState<{
    clientSecret: string
    stripeAccountId: string
    publishableKey: string
    orderToken: string
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Re-quote shipping (debounced) when the address-affecting fields change.
  const quoteAbort = useRef<AbortController | null>(null)
  useEffect(() => {
    if (lines.length === 0) return
    if (!isFormComplete(form)) {
      setShippingCents(null)
      return
    }
    const handle = setTimeout(() => {
      quoteAbort.current?.abort()
      const ctrl = new AbortController()
      quoteAbort.current = ctrl
      setQuoting(true)
      setQuoteError(null)
      fetch("/api/store/shipping-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          lines: lines.map((l) => ({
            variantId: l.variantId,
            quantity: l.quantity,
          })),
          address: toShippingAddress(form),
        }),
      })
        .then(async (r) => {
          if (!r.ok) {
            const data = await r.json().catch(() => ({}))
            throw new Error(data?.error ?? `HTTP ${r.status}`)
          }
          return r.json()
        })
        .then((data) => {
          setShippingCents(data.totalShippingCents ?? 0)
        })
        .catch((err) => {
          if (err?.name === "AbortError") return
          const msg = err instanceof Error ? err.message : String(err)
          setQuoteError(msg)
          setShippingCents(null)
        })
        .finally(() => setQuoting(false))
    }, 400)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lines,
    form.address1,
    form.city,
    form.region,
    form.postalCode,
    form.country,
  ])

  const totalCents = useMemo(
    () => subtotalCents + (shippingCents ?? 0),
    [subtotalCents, shippingCents],
  )

  if (!hydrated) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Loading checkout…
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-20 text-center">
        <ShoppingBag className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm font-medium">Your cart is empty</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/store">Back to shop</Link>
        </Button>
      </div>
    )
  }

  async function handleContinueToPayment() {
    if (!isFormComplete(form)) {
      toast.error("Please fill in all required fields.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/checkout/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((l) => ({
            variantId: l.variantId,
            quantity: l.quantity,
          })),
          buyer: {
            email: form.email.trim().toLowerCase(),
            name: form.name.trim(),
            phone: form.phone.trim() || undefined,
          },
          address: toShippingAddress(form),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      if (!data.publishableKey) {
        throw new Error("Stripe is not configured for this store.")
      }
      setPaymentSession({
        clientSecret: data.clientSecret,
        stripeAccountId: data.stripeAccountId,
        publishableKey: data.publishableKey,
        orderToken: data.orderToken,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (paymentSession) {
    return (
      <PaymentStep
        session={paymentSession}
        lines={lines}
        subtotalCents={subtotalCents}
        shippingCents={shippingCents ?? 0}
        totalCents={totalCents}
        onBack={() => setPaymentSession(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/store/cart"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to cart
      </Link>

      <div>
        <h1 className="font-cal text-3xl font-bold">Checkout</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr,320px]">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-md border p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              Contact
            </h2>
            <Field
              label="Email"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
              type="email"
              required
            />
          </section>

          <section className="flex flex-col gap-3 rounded-md border p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              Shipping address
            </h2>
            <Field
              label="Full name"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              required
            />
            <Field
              label="Phone (optional)"
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
              type="tel"
            />
            <Field
              label="Address line 1"
              value={form.address1}
              onChange={(v) => setForm((f) => ({ ...f, address1: v }))}
              required
            />
            <Field
              label="Address line 2 (optional)"
              value={form.address2}
              onChange={(v) => setForm((f) => ({ ...f, address2: v }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="City"
                value={form.city}
                onChange={(v) => setForm((f) => ({ ...f, city: v }))}
                required
              />
              <Field
                label="State / region"
                value={form.region}
                onChange={(v) => setForm((f) => ({ ...f, region: v }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Postal code"
                value={form.postalCode}
                onChange={(v) => setForm((f) => ({ ...f, postalCode: v }))}
                required
              />
              <Field
                label="Country (ISO 2)"
                value={form.country}
                onChange={(v) =>
                  setForm((f) => ({ ...f, country: v.toUpperCase().slice(0, 2) }))
                }
                required
                maxLength={2}
              />
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-md border p-4 md:sticky md:top-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Order summary
          </h2>
          <ul className="mt-3 flex flex-col gap-3 border-b pb-3">
            {lines.map((line) => (
              <li key={line.variantId} className="flex items-start gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                  {line.imageUrl ? (
                    <Image
                      src={line.imageUrl}
                      alt={line.productName}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex-1 text-xs">
                  <p className="font-medium leading-tight">{line.productName}</p>
                  <p className="text-muted-foreground">
                    Qty {line.quantity} · {formatPrice(line.priceCents)}
                  </p>
                </div>
                <p className="text-sm font-medium tabular-nums">
                  {formatPrice(line.priceCents * line.quantity)}
                </p>
              </li>
            ))}
          </ul>

          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <Row label="Subtotal" value={formatPrice(subtotalCents)} />
            <Row
              label="Shipping"
              value={
                quoting
                  ? "Calculating…"
                  : shippingCents == null
                    ? quoteError
                      ? "Quote failed"
                      : "Enter address"
                    : formatPrice(shippingCents)
              }
            />
            <div className="mt-1 flex items-center justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">
                {shippingCents == null ? "—" : formatPrice(totalCents)}
              </dd>
            </div>
          </dl>

          {quoteError ? (
            <p className="mt-2 text-xs text-red-600">{quoteError}</p>
          ) : null}

          <Button
            size="lg"
            className="mt-4 w-full"
            disabled={
              submitting ||
              quoting ||
              shippingCents == null ||
              !isFormComplete(form)
            }
            onClick={handleContinueToPayment}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Preparing payment…
              </span>
            ) : (
              "Continue to payment"
            )}
          </Button>
        </aside>
      </div>
    </div>
  )
}

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  maxLength?: number
}

function Field({ label, value, onChange, type, required, maxLength }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </Label>
      <Input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        required={required}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Payment step
// ---------------------------------------------------------------------------

interface PaymentStepProps {
  session: {
    clientSecret: string
    stripeAccountId: string
    publishableKey: string
    orderToken: string
  }
  lines: CartLine[]
  subtotalCents: number
  shippingCents: number
  totalCents: number
  onBack: () => void
}

function PaymentStep({
  session,
  lines,
  subtotalCents,
  shippingCents,
  totalCents,
  onBack,
}: PaymentStepProps) {
  // Memoize so loadStripe is called once per session — recreating breaks the
  // Elements provider mid-mount.
  const stripePromise = useMemo<Promise<Stripe | null>>(
    () =>
      loadStripe(session.publishableKey, {
        stripeAccount: session.stripeAccountId,
      }),
    [session.publishableKey, session.stripeAccountId],
  )

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Edit shipping
      </button>

      <h1 className="font-cal text-3xl font-bold">Payment</h1>

      <div className="grid gap-6 md:grid-cols-[1fr,320px]">
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret: session.clientSecret,
            appearance: { theme: "stripe" },
          }}
        >
          <PaymentForm orderToken={session.orderToken} totalCents={totalCents} />
        </Elements>

        <aside className="h-fit rounded-md border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Order summary
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            {lines.length} item{lines.length === 1 ? "" : "s"}
          </p>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <Row label="Subtotal" value={formatPrice(subtotalCents)} />
            <Row label="Shipping" value={formatPrice(shippingCents)} />
            <div className="mt-1 flex items-center justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPrice(totalCents)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  )
}

function PaymentForm({
  orderToken,
  totalCents,
}: {
  orderToken: string
  totalCents: number
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)

    const returnUrl = `${window.location.origin}/store/orders/${orderToken}`
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    })
    if (result.error) {
      setError(result.error.message ?? "Payment failed")
      setSubmitting(false)
    }
    // On success Stripe redirects to return_url — nothing else to do here.
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" size="lg" disabled={!stripe || submitting}>
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Processing…
          </span>
        ) : (
          `Pay ${formatPrice(totalCents)}`
        )}
      </Button>
    </form>
  )
}
