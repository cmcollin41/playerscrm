export interface AddToCalendarEvent {
  name: string
  description?: string | null
  location?: string | null
  starts_at: string
  ends_at?: string | null
}

function toGoogleDate(value: string): string {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
}

function defaultEnd(starts_at: string): string {
  const d = new Date(starts_at)
  d.setHours(d.getHours() + 1)
  return d.toISOString()
}

export function googleCalendarUrl(event: AddToCalendarEvent): string {
  const end = event.ends_at || defaultEnd(event.starts_at)
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.name,
    dates: `${toGoogleDate(event.starts_at)}/${toGoogleDate(end)}`,
  })
  if (event.description) params.set("details", event.description)
  if (event.location) params.set("location", event.location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function outlookCalendarUrl(event: AddToCalendarEvent): string {
  const end = event.ends_at || defaultEnd(event.starts_at)
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.name,
    startdt: event.starts_at,
    enddt: end,
  })
  if (event.description) params.set("body", event.description)
  if (event.location) params.set("location", event.location)
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}
