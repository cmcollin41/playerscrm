import ical, { ICalCalendarMethod } from "ical-generator"

export interface IcsEvent {
  id: string
  name: string
  description?: string | null
  location?: string | null
  starts_at?: string | null
  ends_at?: string | null
  url?: string | null
  updated_at?: string | null
}

export interface IcsSession {
  id: string
  title?: string | null
  description?: string | null
  location?: string | null
  starts_at?: string | null
  ends_at?: string | null
}

function uidHost() {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN || "playerscrm.local"
}

function defaultDuration(start: Date): Date {
  const end = new Date(start)
  end.setHours(end.getHours() + 1)
  return end
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export interface BuildEventIcsOptions {
  event: IcsEvent
  sessions?: IcsSession[]
  calendarName?: string
}

function appendEventToCalendar(
  calendar: ReturnType<typeof ical>,
  event: IcsEvent,
  sessions: IcsSession[] | undefined,
  host: string,
) {
  const hasSessions = !!(sessions && sessions.length > 0)

  if (hasSessions) {
    for (const session of sessions!) {
      const start = parseDate(session.starts_at)
      if (!start) continue
      const end = parseDate(session.ends_at) || defaultDuration(start)
      calendar.createEvent({
        id: `evt-${event.id}-sess-${session.id}@${host}`,
        start,
        end,
        summary: session.title
          ? `${event.name} — ${session.title}`
          : event.name,
        description: session.description || event.description || undefined,
        location: session.location || event.location || undefined,
        url: event.url || undefined,
      })
    }
  } else {
    const start = parseDate(event.starts_at)
    if (start) {
      const end = parseDate(event.ends_at) || defaultDuration(start)
      calendar.createEvent({
        id: `evt-${event.id}@${host}`,
        start,
        end,
        summary: event.name,
        description: event.description || undefined,
        location: event.location || undefined,
        url: event.url || undefined,
      })
    }
  }
}

export function buildEventIcs({
  event,
  sessions,
  calendarName,
}: BuildEventIcsOptions): string {
  const host = uidHost()
  const calendar = ical({
    name: calendarName || event.name,
    prodId: { company: host, product: "playerscrm" },
    method: ICalCalendarMethod.PUBLISH,
  })

  appendEventToCalendar(calendar, event, sessions, host)

  return calendar.toString()
}

export interface BuildSeriesIcsOptions {
  events: { event: IcsEvent; sessions?: IcsSession[] }[]
  calendarName: string
}

export function buildSeriesIcs({
  events,
  calendarName,
}: BuildSeriesIcsOptions): string {
  const host = uidHost()
  const calendar = ical({
    name: calendarName,
    prodId: { company: host, product: "playerscrm" },
    method: ICalCalendarMethod.PUBLISH,
  })

  for (const item of events) {
    appendEventToCalendar(calendar, item.event, item.sessions, host)
  }

  return calendar.toString()
}

export function icsFilename(eventName: string): string {
  const safe = eventName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
  return `${safe || "event"}.ics`
}
