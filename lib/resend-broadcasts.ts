import resend from "./resend"

export interface ResendContact {
  email: string
  firstName?: string
  lastName?: string
  unsubscribed?: boolean
}

export interface BroadcastOptions {
  segmentId: string
  from: string
  subject: string
  html: string
  text?: string
  name?: string
  sendImmediately?: boolean
}

/**
 * Sync a person to Resend as a global contact, optionally adding them to a segment.
 * In Resend v6+, contacts are global — they can belong to multiple segments.
 */
export async function syncPersonToResend(
  person: {
    id: string
    email: string
    first_name?: string
    last_name?: string
  },
  segmentId?: string
) {
  try {
    const createOptions: {
      email: string
      firstName: string
      lastName: string
      unsubscribed: boolean
      segments?: { id: string }[]
    } = {
      email: person.email,
      firstName: person.first_name || "",
      lastName: person.last_name || "",
      unsubscribed: false,
    }

    if (segmentId) {
      createOptions.segments = [{ id: segmentId }]
    }

    const { data, error } = await resend.contacts.create(createOptions)

    if (error) {
      console.error("Error syncing contact to Resend:", error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error("Error syncing contact to Resend:", error)
    return { success: false, error }
  }
}

/**
 * Create a segment in Resend (previously called "audience")
 */
export async function createResendSegment(name: string) {
  try {
    const { data, error } = await resend.segments.create({ name })

    if (error) {
      console.error("Error creating Resend segment:", error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error("Error creating Resend segment:", error)
    return { success: false, error }
  }
}

/**
 * Add an existing contact to a segment.
 * Accepts either a contactId or an email address.
 */
export async function addContactToSegment(
  contactIdOrEmail: string,
  segmentId: string
) {
  try {
    const isEmail = contactIdOrEmail.includes("@")
    const options = isEmail
      ? { email: contactIdOrEmail, segmentId }
      : { contactId: contactIdOrEmail, segmentId }

    const { data, error } = await resend.contacts.segments.add(options)

    if (error) {
      console.error("Error adding contact to segment:", error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error("Error adding contact to segment:", error)
    return { success: false, error }
  }
}

/**
 * Create a broadcast targeting a segment.
 * If sendImmediately is true, uses `send: true` to send in one step.
 */
export async function createBroadcast(options: BroadcastOptions) {
  try {
    const payload: Record<string, unknown> = {
      segmentId: options.segmentId,
      from: options.from,
      subject: options.subject,
      html: options.html,
      name: options.name,
    }

    if (options.text) {
      payload.text = options.text
    }

    if (options.sendImmediately) {
      payload.send = true
    }

    const { data, error } = await resend.broadcasts.create(payload as any)

    if (error) {
      console.error("Error creating broadcast:", error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error("Error creating broadcast:", error)
    return { success: false, error }
  }
}

/**
 * Send a previously-created draft broadcast
 */
export async function sendBroadcast(broadcastId: string) {
  try {
    const { data, error } = await resend.broadcasts.send(broadcastId)

    if (error) {
      console.error("Error sending broadcast:", error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error("Error sending broadcast:", error)
    return { success: false, error }
  }
}

/**
 * Get broadcast details
 */
export async function getBroadcast(broadcastId: string) {
  try {
    const { data, error } = await resend.broadcasts.get(broadcastId)

    if (error) {
      console.error("Error getting broadcast:", error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error("Error getting broadcast:", error)
    return { success: false, error }
  }
}
