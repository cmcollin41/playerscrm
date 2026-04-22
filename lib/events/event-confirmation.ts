import { sendTransactionalEmail } from "@/lib/email-service"

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
    .select("id, name, description, location, starts_at, ends_at, fee_amount, account_id, account:accounts(id, name, senders(id, name, email))")
    .eq("id", eventId)
    .single()

  if (!event) return

  const { data: registrations } = await supabase
    .from("event_registrations")
    .select("id, person:people(id, first_name, last_name, name, email, dependent)")
    .in("id", registrationIds)

  if (!registrations?.length) return

  const senders = event.account?.senders || []
  const preferredSender = senders.find((s: any) => s.email?.includes("youth")) || senders[0]
  const sender = preferredSender?.email
    ? `${event.account.name} <${preferredSender.email}>`
    : null

  if (!sender) {
    console.warn(`[event-confirmation] No sender configured for account ${event.account_id}`)
    return
  }

  const registeredNames = registrations
    .map((r: any) => {
      const p = r.person
      if (!p) return null
      return p.first_name ? `${p.first_name} ${p.last_name || ""}`.trim() : p.name
    })
    .filter(Boolean)
    .join(", ")

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

  const formattedAmount = event.fee_amount
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
        (event.fee_amount * registrations.length) / 100
      )
    : null

  const formattedDate = event.starts_at
    ? new Date(event.starts_at).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null

  const subject = `You're registered for ${event.name}`

  for (const recipient of Array.from(recipientsByEmail.values())) {
    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${subject}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
      .details { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
      .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 14px; color: #6c757d; }
    </style>
  </head>
  <body>
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">${event.account.name}</h1>
      <p style="margin: 10px 0 0 0; color: #6c757d;">Registration confirmed</p>
    </div>
    <p>Hi ${recipient.name},</p>
    <p>You're all set for <strong>${event.name}</strong>.</p>
    <div class="details">
      <p style="margin: 5px 0;"><strong>Registered:</strong> ${registeredNames}</p>
      ${formattedDate ? `<p style="margin: 5px 0;"><strong>When:</strong> ${formattedDate}</p>` : ""}
      ${event.location ? `<p style="margin: 5px 0;"><strong>Where:</strong> ${event.location}</p>` : ""}
      ${formattedAmount ? `<p style="margin: 5px 0;"><strong>Amount paid:</strong> ${formattedAmount}</p>` : ""}
      ${event.description ? `<p style="margin: 15px 0 5px 0;">${event.description}</p>` : ""}
    </div>
    <p>If you have any questions, just reply to this email.</p>
    <div class="footer">
      <p>This is an automated confirmation from ${event.account.name}.</p>
    </div>
  </body>
</html>`.trim()

    const text = `
Registration confirmed — ${event.name}

Hi ${recipient.name},

You're all set for ${event.name}.

Registered: ${registeredNames}
${formattedDate ? `When: ${formattedDate}` : ""}
${event.location ? `Where: ${event.location}` : ""}
${formattedAmount ? `Amount paid: ${formattedAmount}` : ""}
${event.description ? `\n${event.description}` : ""}

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
