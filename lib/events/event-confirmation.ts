import { sendTransactionalEmail } from "@/lib/email-service"
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
    .select("id, name, slug, starts_at, account_id, account:accounts(id, name, subdomain, custom_domain, default_invoice_sender_id, default_sender_id, senders!senders_account_id_fkey(id, name, email))")
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
    const who = registeredNames ? `${registeredNames} ` : ""
    const opening = formattedDate
      ? `Thanks for registering ${who}for <strong>${event.name}</strong>, which starts on ${formattedDate}.`
      : `Thanks for registering ${who}for <strong>${event.name}</strong>.`

    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${subject}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <p>Hi ${recipient.name},</p>
    <p>${opening}</p>
    ${eventUrl ? `<p><a href="${eventUrl}">View event details →</a></p>` : ""}
    <p>If you have any questions, just reply to this email.</p>
  </body>
</html>`.trim()

    const textOpening = formattedDate
      ? `Thanks for registering ${who}for ${event.name}, which starts on ${formattedDate}.`
      : `Thanks for registering ${who}for ${event.name}.`

    const text = `
Hi ${recipient.name},

${textOpening}
${eventUrl ? `\nView event details: ${eventUrl}` : ""}

If you have any questions, just reply to this email.
`.trim()

    const result = await sendTransactionalEmail({
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
