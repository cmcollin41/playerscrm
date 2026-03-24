"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, DollarSign, Mail, Check, Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface RegisterClientProps {
  event: any
  account: any
  registrationOpen: boolean
}

type Step = "info" | "email" | "magic-link-sent" | "select-kids" | "payment" | "success"

export function RegisterClient({ event, account, registrationOpen }: RegisterClientProps) {
  const supabase = createClient()
  const [step, setStep] = useState<Step>("info")
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [family, setFamily] = useState<any[]>([])
  const [familyLoading, setFamilyLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [registering, setRegistering] = useState(false)
  const [showAddChild, setShowAddChild] = useState(false)
  const [newChild, setNewChild] = useState({ first_name: "", last_name: "", grade: "" })
  const [addingChild, setAddingChild] = useState(false)
  const [registerSelf, setRegisterSelf] = useState(false)
  const [selfName, setSelfName] = useState({ first_name: "", last_name: "", grade: "" })
  const [addingSelf, setAddingSelf] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripeAccount, setStripeAccount] = useState<string | null>(null)
  const [hasSelfInList, setHasSelfInList] = useState(false)

  // Wait for auth session to be fully ready before querying RLS-protected tables
  useEffect(() => {
    let loaded = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // INITIAL_SESSION fires once when the client finishes restoring the session
      // SIGNED_IN fires after magic link or fresh login
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        if (loaded) return
        if (session?.user) {
          loaded = true
          setUser(session.user)
          setStep("select-kids")
          setFamilyLoading(true)
          try {
            await loadFamily(session.user.id)
          } catch (err) {
            console.error("loadFamily error:", err)
          } finally {
            setFamilyLoading(false)
          }
        }
        setAuthLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadFamily = async (userId: string) => {
    // Get user's profile — also try auth email as fallback for people lookup
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const authEmail = authUser?.email

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, people_id, email")
      .eq("id", userId)
      .single()

    if (!profile) return

    let selfPerson: any = null
    let allFamily: any[] = []

    // Find the person record for the logged-in user
    if (profile.people_id) {
      const { data: self } = await supabase
        .from("people")
        .select("id, first_name, last_name, grade, email, dependent")
        .eq("id", profile.people_id)
        .single()
      selfPerson = self
    }

    // Fallback: try profile email, then auth email
    if (!selfPerson && (profile.email || authEmail)) {
      const lookupEmail = profile.email || authEmail
      const { data: self } = await supabase
        .from("people")
        .select("id, first_name, last_name, grade, email, dependent")
        .eq("email", lookupEmail!)
        .limit(1)
        .maybeSingle()
      selfPerson = self
    }

    setHasSelfInList(!!selfPerson)

    // Get dependents via relationships (if the user has a person record)
    if (selfPerson) {
      const { data: relationships } = await supabase
        .from("relationships")
        .select("relation_id, people!relationships_relation_id_fkey(id, first_name, last_name, grade, email)")
        .eq("person_id", selfPerson.id)

      const dependents = relationships?.map((r: any) => r.people).filter(Boolean) || []
      allFamily = [selfPerson, ...dependents]
    }

    // Deduplicate by id
    const seen = new Set<string>()
    allFamily = allFamily.filter(p => {
      if (!p?.id || seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })

    setFamily(allFamily)

    // Check already registered
    const { data: existing } = await supabase
      .from("event_registrations")
      .select("person_id")
      .eq("event_id", event.id)

    const registeredIds = new Set(existing?.map(r => r.person_id) || [])
    setFamily(prev => prev.map(p => ({ ...p, alreadyRegistered: registeredIds.has(p.id) })))
  }

  const handleSendMagicLink = async () => {
    if (!email) return
    setSending(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/register/${event.slug}`,
      },
    })

    if (error) {
      toast.error(error.message)
      setSending(false)
      return
    }

    setStep("magic-link-sent")
    setSending(false)
  }

  const toggleChild = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAddChild = async () => {
    if (!newChild.first_name || !newChild.last_name) {
      toast.error("Name is required")
      return
    }

    setAddingChild(true)
    try {
      // Create the person
      const { data: person, error: personError } = await supabase
        .from("people")
        .insert({
          account_id: account.id,
          first_name: newChild.first_name,
          last_name: newChild.last_name,
          name: `${newChild.first_name} ${newChild.last_name}`,
          grade: newChild.grade || null,
          dependent: true,
        })
        .select("id, first_name, last_name, grade, email")
        .single()

      if (personError) throw personError

      // Create account_people link
      await supabase.from("account_people").upsert(
        { account_id: account.id, person_id: person.id },
        { onConflict: "account_id,person_id" }
      )

      // Create relationship (parent → child)
      // Link child to parent via relationship
      const { data: profile } = await supabase
        .from("profiles")
        .select("people_id")
        .eq("id", user.id)
        .single()

      let parentPersonId = profile?.people_id
      // If no people_id on profile, find parent by email
      if (!parentPersonId && user?.email) {
        const { data: parentPerson } = await supabase
          .from("people")
          .select("id")
          .eq("email", user.email)
          .limit(1)
          .maybeSingle()
        parentPersonId = parentPerson?.id
      }

      if (parentPersonId) {
        await supabase.from("relationships").insert({
          person_id: parentPersonId,
          relation_id: person.id,
          name: "Parent",
          primary: true,
        })
      }

      setFamily(prev => [...prev, person])
      setSelected(prev => new Set(prev).add(person.id))
      setNewChild({ first_name: "", last_name: "", grade: "" })
      setShowAddChild(false)
      toast.success("Child added")
    } catch (err: any) {
      toast.error(err.message || "Failed to add child")
    } finally {
      setAddingChild(false)
    }
  }

  const handleAddSelf = async () => {
    if (!selfName.first_name || !selfName.last_name) {
      toast.error("Name is required")
      return
    }

    setAddingSelf(true)
    try {
      const { data: person, error: personError } = await supabase
        .from("people")
        .insert({
          account_id: account.id,
          first_name: selfName.first_name,
          last_name: selfName.last_name,
          name: `${selfName.first_name} ${selfName.last_name}`,
          email: user?.email || null,
          grade: selfName.grade || null,
          dependent: false,
        })
        .select("id, first_name, last_name, grade, email")
        .single()

      if (personError) throw personError

      // Link to account
      await supabase.from("account_people").upsert(
        { account_id: account.id, person_id: person.id },
        { onConflict: "account_id,person_id" }
      )

      // Link person to profile
      await supabase
        .from("profiles")
        .update({ people_id: person.id })
        .eq("id", user.id)

      setFamily(prev => [...prev, person])
      setSelected(prev => new Set(prev).add(person.id))
      setSelfName({ first_name: "", last_name: "", grade: "" })
      setRegisterSelf(false)
      setHasSelfInList(true)
      toast.success("Added")
    } catch (err: any) {
      toast.error(err.message || "Failed to add")
    } finally {
      setAddingSelf(false)
    }
  }

  const handleRegister = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one person to register")
      return
    }

    setRegistering(true)
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: event.id,
          person_ids: Array.from(selected),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // If free event, go straight to success
      if (!data.client_secret) {
        setStep("success")
        return
      }

      // Show Stripe payment form
      setClientSecret(data.client_secret)
      setStripeAccount(data.stripe_account)
      setStep("payment")
    } catch (err: any) {
      toast.error(err.message || "Registration failed")
    } finally {
      setRegistering(false)
    }
  }

  const totalAmount = ((event.fee_amount * selected.size) / 100).toFixed(2)

  return (
    <>
      {/* Event header - always visible */}
      <Card className="mb-6">
        <CardHeader className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">
            {account?.name}
          </p>
          <CardTitle className="text-2xl">{event.name}</CardTitle>
          {event.description && (
            <CardDescription className="mt-2">{event.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600">
            {event.starts_at && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {new Date(event.starts_at).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {event.location}
              </span>
            )}
            {event.fee_amount > 0 && (
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                ${(event.fee_amount / 100).toFixed(2)} per person
                {event.fee_description && (
                  <span className="text-gray-400">({event.fee_description})</span>
                )}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {authLoading && step === "info" && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </CardContent>
        </Card>
      )}

      {!authLoading && !registrationOpen && step === "info" && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">Registration is currently closed.</p>
          </CardContent>
        </Card>
      )}

      {/* Step: Info → Register button */}
      {!authLoading && registrationOpen && step === "info" && (
        <Card>
          <CardContent className="py-6 text-center">
            <Button size="lg" onClick={() => setStep("email")}>
              Register Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step: Enter email */}
      {step === "email" && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Sign in to register</CardTitle>
            <CardDescription>
              Enter your email and we'll send you a sign-in link
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="parent@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMagicLink()}
              />
            </div>
            <Button className="w-full" onClick={handleSendMagicLink} disabled={sending || !email}>
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Send Sign-In Link
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step: Magic link sent */}
      {step === "magic-link-sent" && (
        <Card>
          <CardContent className="py-8 text-center">
            <Mail className="mx-auto h-10 w-10 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold">Check your email</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
              We sent a sign-in link to <strong>{email}</strong>. Click the link in the email to continue registration.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step: Select kids */}
      {step === "select-kids" && (
        <>
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5 mb-4 text-sm">
          <span className="text-gray-500">
            Signed in as <span className="font-medium text-gray-900">{user?.email}</span>
          </span>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              setUser(null)
              setFamily([])
              setSelected(new Set())
              setStep("info")
            }}
            className="text-gray-400 hover:text-gray-600 text-xs font-medium"
          >
            Sign out
          </button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Who are you registering?</CardTitle>
            <CardDescription>Select the people you'd like to register for this event</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {familyLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400 mr-2" />
                <span className="text-sm text-gray-500">Loading your people...</span>
              </div>
            )}

            {!familyLoading && (
              <>
                {/* Register myself — only show if user has no person record yet */}
                {!registerSelf && !hasSelfInList && (
                  <button
                    onClick={() => setRegisterSelf(true)}
                    className="flex w-full items-center gap-3 rounded-lg border border-dashed border-gray-300 p-3 text-left text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    Register myself
                  </button>
                )}

                {registerSelf && (
                  <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Register myself</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">First Name *</Label>
                        <Input
                          placeholder="First"
                          value={selfName.first_name}
                          onChange={(e) => setSelfName(p => ({ ...p, first_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Last Name *</Label>
                        <Input
                          placeholder="Last"
                          value={selfName.last_name}
                          onChange={(e) => setSelfName(p => ({ ...p, last_name: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Grade</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={selfName.grade}
                        onChange={(e) => setSelfName(p => ({ ...p, grade: e.target.value }))}
                      >
                        <option value="">Select grade</option>
                        {[...Array(12)].map((_, i) => (
                          <option key={i} value={String(i + 1)}>{i + 1}</option>
                        ))}
                        <option value="Graduated">Graduated</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddSelf} disabled={addingSelf}>
                        {addingSelf ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRegisterSelf(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* People list */}
                {family.map((person) => (
                  <button
                    key={person.id}
                    disabled={person.alreadyRegistered}
                    onClick={() => toggleChild(person.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      person.alreadyRegistered
                        ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                        : selected.has(person.id)
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      selected.has(person.id) ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300"
                    }`}>
                      {selected.has(person.id) && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {person.first_name} {person.last_name}
                      </p>
                      {person.grade && (
                        <p className="text-xs text-gray-500">Grade {person.grade}</p>
                      )}
                    </div>
                    {person.alreadyRegistered && (
                      <Badge variant="secondary" className="text-[10px]">Already registered</Badge>
                    )}
                  </button>
                ))}

                {/* Add another person — always at bottom */}
                {!showAddChild ? (
                  <button
                    onClick={() => setShowAddChild(true)}
                    className="flex w-full items-center gap-3 rounded-lg border border-dashed border-gray-300 p-3 text-left text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    Add another person
                  </button>
                ) : (
                  <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Add a person</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">First Name *</Label>
                        <Input
                          placeholder="First"
                          value={newChild.first_name}
                          onChange={(e) => setNewChild(p => ({ ...p, first_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Last Name *</Label>
                        <Input
                          placeholder="Last"
                          value={newChild.last_name}
                          onChange={(e) => setNewChild(p => ({ ...p, last_name: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Grade</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={newChild.grade}
                        onChange={(e) => setNewChild(p => ({ ...p, grade: e.target.value }))}
                      >
                        <option value="">Select grade</option>
                        {[...Array(12)].map((_, i) => (
                          <option key={i} value={String(i + 1)}>{i + 1}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddChild} disabled={addingChild}>
                        {addingChild ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowAddChild(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="pt-4 border-t">
              {event.fee_amount > 0 && selected.size > 0 && (
                <p className="mb-3 text-sm text-gray-600 text-center">
                  Total: <strong>${((event.fee_amount * selected.size) / 100).toFixed(2)}</strong>
                  {selected.size > 1 && (
                    <span className="text-gray-400"> ({selected.size} x ${(event.fee_amount / 100).toFixed(2)})</span>
                  )}
                </p>
              )}
              <Button
                className="w-full"
                size="lg"
                onClick={handleRegister}
                disabled={registering || selected.size === 0}
              >
                {registering ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : event.fee_amount > 0 ? (
                  "Continue to Payment"
                ) : (
                  "Complete Registration"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        </>
      )}

      {/* Step: Payment */}
      {step === "payment" && clientSecret && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Payment</CardTitle>
            <CardDescription>
              ${((event.fee_amount * selected.size) / 100).toFixed(2)} for {selected.size} {selected.size === 1 ? "person" : "people"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Elements
              stripe={stripeAccount
                ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, { stripeAccount })
                : stripePromise
              }
              options={{
                clientSecret,
                appearance: {
                  theme: "stripe",
                  variables: { colorPrimary: "#18181b" },
                },
              }}
            >
              <PaymentForm onSuccess={() => setStep("success")} />
            </Elements>
          </CardContent>
        </Card>
      )}

      {/* Step: Success */}
      {step === "success" && (
        <Card>
          <CardContent className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold">Registration complete</h3>
            <p className="mt-2 text-sm text-gray-500">
              You're all set for {event.name}. We'll send details to your email.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function PaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setPaying(true)
    setError(null)

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    })

    if (confirmError) {
      setError(confirmError.message || "Payment failed")
      setPaying(false)
      return
    }

    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={paying || !stripe}>
        {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {paying ? "Processing..." : "Pay Now"}
      </Button>
    </form>
  )
}
