"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import InvoiceSheet, {
  type InvoiceRosterOption,
} from "@/components/modal/invoice-sheet"
import { createClient } from "@/lib/supabase/client"

interface NewInvoiceButtonProps {
  accountId: string
  stripeAccountId: string | null
}

interface PersonResult {
  id: string
  first_name: string | null
  last_name: string | null
  name: string | null
  email: string | null
  dependent: boolean | null
}

interface Contact {
  id: string
  email: string | null
}

interface SelectedPerson extends PersonResult {
  primary_contacts: Contact[]
}

function displayName(p: PersonResult): string {
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim()
  return full || p.name || "Unnamed"
}

/** Strip characters that would break a PostgREST `or` filter. */
function sanitizeSearch(value: string): string {
  return value.replace(/[,()%*\\]/g, " ").trim()
}

export default function NewInvoiceButton({
  accountId,
  stripeAccountId,
}: NewInvoiceButtonProps) {
  const router = useRouter()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PersonResult[]>([])
  const [searching, setSearching] = useState(false)
  const [loadingPersonId, setLoadingPersonId] = useState<string | null>(null)
  const [person, setPerson] = useState<SelectedPerson | null>(null)
  const [rosterOptions, setRosterOptions] = useState<InvoiceRosterOption[]>([])
  const [invoiceOpen, setInvoiceOpen] = useState(false)

  useEffect(() => {
    if (!pickerOpen) return
    const term = sanitizeSearch(query)
    if (term.length < 2) {
      setResults([])
      return
    }

    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      const supabase = createClient()
      let request = supabase
        .from("people")
        .select("id, first_name, last_name, name, email, dependent")
        .eq("account_id", accountId)
        .limit(12)

      // Every word must match some name/email field, so "van john" works.
      for (const word of term.split(/\s+/)) {
        request = request.or(
          `first_name.ilike.%${word}%,last_name.ilike.%${word}%,name.ilike.%${word}%,email.ilike.%${word}%`,
        )
      }

      const { data, error } = await request
      if (cancelled) return
      if (error) console.error("New invoice person search:", error.message)
      setResults((data as PersonResult[] | null) ?? [])
      setSearching(false)
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, pickerOpen, accountId])

  function handleOpen() {
    if (!stripeAccountId) {
      toast.error("Connect Stripe in Settings before creating invoices")
      return
    }
    setQuery("")
    setResults([])
    setPickerOpen(true)
  }

  async function handleSelect(selected: PersonResult) {
    setLoadingPersonId(selected.id)
    try {
      const supabase = createClient()

      const [{ data: relationships }, { data: rosters }] = await Promise.all([
        supabase
          .from("relationships")
          .select("person_id")
          .eq("relation_id", selected.id)
          .eq("primary", true),
        supabase
          .from("rosters")
          .select("id, team:teams(name)")
          .eq("person_id", selected.id),
      ])

      const guardianIds = (relationships ?? []).map((r) => r.person_id)
      let contacts: Contact[] = []
      if (guardianIds.length > 0) {
        const { data: guardians } = await supabase
          .from("people")
          .select("id, email")
          .in("id", guardianIds)
        contacts = ((guardians as Contact[] | null) ?? []).filter(
          (g) => !!g.email?.trim(),
        )
      }

      if (!selected.email?.trim() && contacts.length === 0) {
        toast.error(
          `${displayName(
            selected,
          )} has no email and no primary contact with an email. Add one before invoicing.`,
        )
        return
      }

      setRosterOptions(
        (rosters ?? []).map((r: any) => ({
          rosterId: r.id,
          label: r.team?.name || "Team",
        })),
      )
      setPerson({ ...selected, primary_contacts: contacts })
      setPickerOpen(false)
      setInvoiceOpen(true)
    } finally {
      setLoadingPersonId(null)
    }
  }

  return (
    <>
      <Button onClick={handleOpen}>+ New Invoice</Button>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New invoice</DialogTitle>
            <p className="text-muted-foreground pt-1 text-sm font-normal">
              Choose who the invoice is for.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-4">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
          />
          <div>
            {sanitizeSearch(query).length < 2 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Type at least 2 characters to search.
              </p>
            ) : searching && results.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Searching…
              </p>
            ) : results.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No people found.
              </p>
            ) : (
              <ul className="divide-y">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={loadingPersonId !== null}
                      onClick={() => void handleSelect(p)}
                      className="flex w-full items-center justify-between gap-3 px-2 py-2.5 text-left text-sm hover:bg-gray-50 disabled:opacity-60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-900">
                          {displayName(p)}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {p.email ||
                            (p.dependent
                              ? "Billed to primary contact"
                              : "No email")}
                        </span>
                      </span>
                      {loadingPersonId === p.id ? (
                        <span className="text-muted-foreground text-xs">
                          Loading…
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {person ? (
        <InvoiceSheet
          person={person}
          account={{ id: accountId, stripe_id: stripeAccountId }}
          open={invoiceOpen}
          onOpenChange={setInvoiceOpen}
          rosterOptions={rosterOptions}
          onInvoiceCreated={() => router.refresh()}
        />
      ) : null}
    </>
  )
}
