import { campApp } from "./camp"
import { gameApp } from "./game"
import { otherApp } from "./other"
import { practiceApp } from "./practice"
import { tournamentApp } from "./tournament"
import type { EventApp } from "./types"

export type { EventApp, EventAppCapabilities, EventAppDefaults, EventAppFormContext } from "./types"

export const eventApps: EventApp[] = [
  campApp,
  gameApp,
  practiceApp,
  otherApp,
  tournamentApp,
]

// Slug -> app lookup, with a generic fallback so unknown slugs (legacy data,
// in-flight integrations) never crash a render. The fallback inherits the
// "other" defaults and behaves like a vanilla event.
const FALLBACK_APP: EventApp = {
  slug: "unknown",
  name: "Event",
  description: "",
  hidden: true,
  capabilities: {},
  defaults: otherApp.defaults,
}

const appsBySlug = new Map(eventApps.map((a) => [a.slug, a]))

export function getEventApp(slug: string | null | undefined): EventApp {
  if (!slug) return FALLBACK_APP
  return appsBySlug.get(slug) ?? { ...FALLBACK_APP, slug, name: slug }
}

/** Apps that should appear in the generic create-event picker. */
export function listSelectableEventApps(): EventApp[] {
  return eventApps.filter((a) => !a.hidden)
}
