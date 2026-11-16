import { createElement } from "react"
import {
  EventConfirmationEmail,
  eventConfirmationEmailText,
  type EventConfirmationEmailProps,
} from "@/components/emails/event-confirmation-email"
import { sendTransactionalEmail } from "@/lib/email-service"
import { renderEmail } from "@/lib/emails/render"
import { resolveSender } from "@/lib/sender"
import { storefrontBaseUrl } from "@/lib/store/links"

interface Recipient {
  email: string
  name: string
  person_id: string
}

export async function sendEventConfirmations(opts: {
  eventId: string
  registrationIds: string[]
  supabase: any
}) {
  const { eventId, registrationIds, supabase } = opts

  const { data: event } = await supabase
    .from("events")
    .select("id, name, slug, starts_at, account_id, account:accounts(id, name, logo, subdomain, custom_domain, default_invoice_sender_id, default_sender_id, senders!senders_account_id_fkey(id, name, email))")
    .eq("id", eventId)
    .single()

  if (!event) return

  const { data: registrations } = await supabase
    .from("event_registrations")
    .select("id, person:people(id, first_name, last_name, name, email, dependent)")
    .in("id", registrationIds)

  if (!registrations?.length) return

  const registeredNames = registrations
    .map((r: any) => {
      const p = r.person
      if (!p) return null
      return p.first_name ? `${p.first_name} ${p.last_name || ""}`.trim() : p.name
    })
    .filter(Boolean)
    .join(", ")

  const sender = resolveSender(event.account, "default")

  const recipientsByEmail = new Map<string, Recipient>()

  for (const reg of registrations) {
    const person = (reg as any).person
    if (!person) continue

    if (person.email && !person.dependent) {
      recipientsByEmail.set(person.email.toLowerCase(), {
        email: person.email,
        name: person.first_name || person.name || "there",
        person_id: person.id,
      })
    }

    if (person.dependent) {
      const { data: relationships } = await supabase
        .from("relationships")
        .select("person_id")
        .eq("relation_id", person.id)
        .eq("primary", true)

      if (relationships?.length) {
        const guardianIds = relationships.map((r: any) => r.person_id)
        const { data: guardians } = await supabase
          .from("people")
          .select("id, email, first_name, name")
          .in("id", guardianIds)

        for (const g of guardians || []) {
          if (g.email && !recipientsByEmail.has(g.email.toLowerCase())) {
            recipientsByEmail.set(g.email.toLowerCase(), {
              email: g.email,
              name: g.first_name || g.name || "there",
              person_id: g.id,
            })
          }
        }
      }
    }
  }

  if (recipientsByEmail.size === 0) {
    console.warn(`[event-confirmation] No recipients resolved for event ${eventId}`)
    return
  }

  // No per-event timezone stored; default to Mountain so dates render in
  // local wall-clock terms rather than UTC.
  const formattedDate = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "America/Denver",
      })
    : null

  const baseUrl = storefrontBaseUrl(event.account)
  const eventUrl = baseUrl && event.slug ? `${baseUrl}/register/${event.slug}` : null

  const subject = `You're registered for ${event.name}`

  for (const recipient of Array.from(recipientsByEmail.values())) {
    const props: EventConfirmationEmailProps = {
        accountName: event.account?.name || "PlayersCRM",
        logoUrl: /^https?:\/\//i.test(event.account?.logo || "")
          ? event.account.logo
          : null,
        recipientName: recipient.name,
        eventName: event.name,
        eventDate: formattedDate,
        registeredNames: registeredNames || null,
        eventUrl,
      }
    const { html, text } = await renderEmail(
      createElement(EventConfirmationEmail, props),
      eventConfirmationEmailText(props),
    )

    const result = await sendTransactionalEmail({
      supabase,
      sender,
      to: recipient.email,
      subject,
      html,
      text,
      account_id: event.account_id,
      person_id: recipient.person_id,
      metadata: {
        type: "event_confirmation",
        event_id: event.id,
        registration_ids: registrationIds,
      },
    })

    if (!result.success) {
      console.error(`[event-confirmation] Failed to send to ${recipient.email}:`, result.error)
    }
  }
}
