"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { loadStripe, type Stripe } from "@stripe/stripe-js"
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js"
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  ShoppingBag,
  UserCircle2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCart, type CartLine } from "@/providers/cart-provider"
import {
  MobileOrderSummary,
  OrderSummary,
  type PartnerShipping,
} from "./order-summary"

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

export interface InitialUser {
  profileId: string
  email: string
  name: string
  phone: string
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

export function CheckoutForm({
  initialUser,
}: {
  initialUser: InitialUser | null
}) {
  const router = useRouter()
  const { lines, hydrated, subtotalCents } = useCart()
  const [form, setForm] = useState<AddressForm>(() => ({
    ...DEFAULT_FORM,
    email: initialUser?.email ?? "",
    name: initialUser?.name ?? "",
    phone: initialUser?.phone ?? "",
  }))
  const [useGuestEmail, setUseGuestEmail] = useState(false)
  const showSignedIn = initialUser != null && !useGuestEmail
  // When the user isn't logged in we gate the form behind a Sign in / Guest
  // choice. The choice persists in localStorage so a page refresh after
  // bouncing to /login doesn't re-trigger the gate.
  const [guestChosen, setGuestChosen] = useState(false)
  useEffect(() => {
    try {
      if (window.localStorage.getItem("athletes_store_checkout_guest") === "1") {
        setGuestChosen(true)
      }
    } catch {}
  }, [])
  const needsAuthChoice = initialUser == null && !guestChosen
  const [shippingCents, setShippingCents] = useState<number | null>(null)
  const [partnerShipping, setPartnerShipping] = useState<
    PartnerShipping[] | null
  >(null)
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
      setPartnerShipping(null)
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
          setPartnerShipping(
            Array.isArray(data.perConnection) ? data.perConnection : null,
          )
        })
        .catch((err) => {
          if (err?.name === "AbortError") return
          const msg = err instanceof Error ? err.message : String(err)
          setQuoteError(msg)
          setShippingCents(null)
          setPartnerShipping(null)
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
          profileId: showSignedIn ? initialUser?.profileId : undefined,
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
        partnerShipping={partnerShipping}
        totalCents={totalCents}
        onBack={() => setPaymentSession(null)}
      />
    )
  }

  if (needsAuthChoice) {
    return (
      <div className="flex flex-col gap-6">
        <Link
          href="/store"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Continue shopping
        </Link>

        <div>
          <h1 className="font-cal text-3xl font-bold">Checkout</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            How would you like to check out?
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/login"
            className="flex flex-col gap-2 rounded-md border p-5 transition hover:border-foreground hover:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <UserCircle2 className="h-5 w-5" />
              <span className="text-sm font-semibold">
                Sign in to Athletes App
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Use your saved details, see this order in your history, and skip
              re-entering your address next time.
            </p>
            <span className="mt-2 text-xs font-medium underline">
              Sign in →
            </span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setGuestChosen(true)
              try {
                window.localStorage.setItem(
                  "athletes_store_checkout_guest",
                  "1",
                )
              } catch {}
            }}
            className="flex flex-col gap-2 rounded-md border p-5 text-left transition hover:border-foreground hover:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              <span className="text-sm font-semibold">Continue as guest</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Just need your email and shipping address. You can always create
              an account later.
            </p>
            <span className="mt-2 text-xs font-medium underline">
              Check out as guest →
            </span>
          </button>
        </div>
      </div>
    )
  }

  const shippingDisplay = quoting
    ? "Calculating…"
    : shippingCents == null
      ? quoteError
        ? "Quote failed"
        : "Enter address"
      : null
  const totalForSummary = shippingCents == null ? null : totalCents

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/store"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Continue shopping
      </Link>

      <div>
        <h1 className="font-cal text-3xl font-bold">Checkout</h1>
      </div>

      <MobileOrderSummary
        lines={lines}
        subtotalCents={subtotalCents}
        shippingCents={shippingCents}
        shippingDisplay={shippingDisplay}
        partnerShipping={partnerShipping}
        totalCents={totalForSummary}
      />

      <div className="grid gap-6 md:grid-cols-[1fr,320px]">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-md border p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                Contact
              </h2>
              {initialUser == null ? (
                <Link
                  href="/login"
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Sign in instead
                </Link>
              ) : null}
            </div>

            {showSignedIn ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
                <div className="flex items-center gap-3">
                  <UserCircle2 className="h-5 w-5 text-muted-foreground" />
                  <div className="text-sm leading-tight">
                    <p className="font-medium">{initialUser!.email}</p>
                    {initialUser!.name ? (
                      <p className="text-xs text-muted-foreground">
                        Signed in as {initialUser!.name}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Signed in</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUseGuestEmail(true)
                    setForm((f) => ({ ...f, email: "" }))
                  }}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <>
                <Field
                  label="Email"
                  value={form.email}
                  onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                  type="email"
                  required
                />
                {initialUser != null ? (
                  <button
                    type="button"
                    onClick={() => {
                      setUseGuestEmail(false)
                      setForm((f) => ({ ...f, email: initialUser.email }))
                    }}
                    className="self-start text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    Use my signed-in email ({initialUser.email})
                  </button>
                ) : null}
              </>
            )}
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

          <div className="flex flex-col gap-2 rounded-md border p-4">
            {quoteError ? (
              <p className="text-xs text-red-600">{quoteError}</p>
            ) : null}
            <Button
              size="lg"
              className="w-full"
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
                  <Loader2 className="h-4 w-4 animate-spin" /> Preparing
                  payment…
                </span>
              ) : (
                "Continue to payment"
              )}
            </Button>
          </div>
        </div>

        <OrderSummary
          lines={lines}
          subtotalCents={subtotalCents}
          shippingCents={shippingCents}
          shippingDisplay={shippingDisplay}
          partnerShipping={partnerShipping}
          totalCents={totalForSummary}
        />
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
  partnerShipping: PartnerShipping[] | null
  totalCents: number
  onBack: () => void
}

function PaymentStep({
  session,
  lines,
  subtotalCents,
  shippingCents,
  partnerShipping,
  totalCents,
  onBack,
}: PaymentStepProps) {
  // Bumping retryKey re-runs the loadStripe useMemo and remounts Elements
  // when the buyer clicks "Try again" after a failed script load.
  const [retryKey, setRetryKey] = useState(0)
  const [stripeStatus, setStripeStatus] = useState<
    "loading" | "ready" | "error"
  >("loading")
  const [slowLoad, setSlowLoad] = useState(false)

  // Memoize so loadStripe runs once per (key + account) — recreating mid-render
  // would unmount and remount Elements, breaking the iframe.
  const stripePromise = useMemo<Promise<Stripe | null>>(() => {
    const p = loadStripe(session.publishableKey, {
      stripeAccount: session.stripeAccountId,
    })
    p.then((s) => {
      setStripeStatus(s ? "ready" : "error")
    }).catch(() => setStripeStatus("error"))
    return p
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.publishableKey, session.stripeAccountId, retryKey])

  // Surface a "still loading" hint after 6s — script-blocking extensions or
  // slow networks are the usual culprits.
  useEffect(() => {
    if (stripeStatus !== "loading") return
    setSlowLoad(false)
    const t = setTimeout(() => setSlowLoad(true), 6000)
    return () => clearTimeout(t)
  }, [stripeStatus, retryKey])

  function retry() {
    setStripeStatus("loading")
    setSlowLoad(false)
    setRetryKey((k) => k + 1)
  }

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

      <MobileOrderSummary
        lines={lines}
        subtotalCents={subtotalCents}
        shippingCents={shippingCents}
        partnerShipping={partnerShipping}
        totalCents={totalCents}
      />

      <div className="grid gap-6 md:grid-cols-[1fr,320px]">
        <div className="flex flex-col gap-4">
          {stripeStatus === "error" ? (
            <div className="flex flex-col items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <p className="font-medium">Couldn&apos;t load Stripe</p>
              </div>
              <p className="text-xs">
                A browser extension or your network blocked Stripe&apos;s
                checkout script. Disable any ad / privacy blockers for this
                site and try again.
              </p>
              <Button size="sm" variant="outline" onClick={retry}>
                Try again
              </Button>
            </div>
          ) : null}

          {stripeStatus === "loading" ? (
            <div className="flex flex-col items-stretch gap-3 rounded-md border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading secure payment form…
              </div>
              <div className="h-10 animate-pulse rounded-md bg-muted/60" />
              <div className="h-10 animate-pulse rounded-md bg-muted/60" />
              {slowLoad ? (
                <p className="text-xs text-amber-700">
                  Taking longer than usual — check your connection or disable
                  ad / privacy blockers.{" "}
                  <button
                    type="button"
                    onClick={retry}
                    className="underline"
                  >
                    Retry
                  </button>
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Keep <Elements> mounted only while stripePromise has resolved
              successfully. Once mounted Stripe owns the iframe lifecycle. */}
          {stripeStatus === "ready" ? (
            <Elements
              key={retryKey}
              stripe={stripePromise}
              options={{
                clientSecret: session.clientSecret,
                appearance: { theme: "stripe" },
              }}
            >
              <PaymentForm
                orderToken={session.orderToken}
                totalCents={totalCents}
              />
            </Elements>
          ) : null}
        </div>

        <OrderSummary
          lines={lines}
          subtotalCents={subtotalCents}
          shippingCents={shippingCents}
          partnerShipping={partnerShipping}
          totalCents={totalCents}
        />
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
