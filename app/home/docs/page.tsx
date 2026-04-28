import Link from "next/link"
import { ArrowRight, ExternalLink } from "lucide-react"

export const metadata = {
  title: "API Documentation · Athletes App",
  description:
    "Public REST API for embedding rosters, teams, and event registration on third-party websites.",
}

export default function DocsPage() {
  return (
    <div className="bg-white">
      <section className="border-b border-gray-100 bg-gradient-to-b from-blue-50 to-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
            Developer documentation
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Athletes App Public API
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-gray-600">
            A read-only JSON API for embedding your roster, teams, and event
            registration links on any external site — your school&apos;s
            homepage, a club marketing page, or a fan portal.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <a
              href="#getting-started"
              className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              Get started
            </a>
            <a
              href="#endpoints"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
            >
              Endpoint reference
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <nav
          aria-label="Table of contents"
          className="mb-12 rounded-xl border border-gray-200 bg-gray-50 p-6"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Contents
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <TocLink href="#getting-started">Getting started</TocLink>
            <TocLink href="#authentication">Authentication</TocLink>
            <TocLink href="#cors">CORS &amp; embedding</TocLink>
            <TocLink href="#caching">Caching</TocLink>
            <TocLink href="#errors">Errors</TocLink>
            <TocLink href="#endpoints">Endpoints</TocLink>
            <TocLink href="#endpoint-events">→ GET /api/public/events</TocLink>
            <TocLink href="#endpoint-players">
              → GET /api/public/players
            </TocLink>
            <TocLink href="#endpoint-teams">→ GET /api/public/teams</TocLink>
            <TocLink href="#examples">Code examples</TocLink>
            <TocLink href="#changelog">Changelog</TocLink>
          </ul>
        </nav>

        <Section id="getting-started" title="Getting started">
          <p>
            All endpoints live under{" "}
            <Code>https://athletes.app/api/public/*</Code> and return JSON.
            They&apos;re designed for read-only embedding — list your events on
            a school site, render a roster on a club page, link straight to a
            hosted registration checkout — without ever needing to authenticate
            or store credentials in client-side code.
          </p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">
            Find your account ID
          </h3>
          <p>
            Every endpoint requires an{" "}
            <Code>account_id</Code> query parameter. Find yours in the
            dashboard under{" "}
            <Link href="/login" className="text-blue-600 underline">
              Settings → Account
            </Link>
            . It&apos;s a UUID and it&apos;s safe to expose publicly — it acts
            as a tenant identifier, not a secret.
          </p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">Base URL</h3>
          <CodeBlock>https://athletes.app/api/public</CodeBlock>
        </Section>

        <Section id="authentication" title="Authentication">
          <p>
            None. The public API is unauthenticated by design. Only data
            explicitly marked public in the dashboard is returned:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>
              Events with <Code>is_published = true</Code>
            </li>
            <li>
              Teams with <Code>is_public = true</Code>,{" "}
              <Code>is_active = true</Code>, and <Code>level = varsity</Code>
            </li>
            <li>
              People with <Code>is_public = true</Code> on a public team
            </li>
          </ul>
          <p className="mt-3">
            Anything else stays private even if you have the right{" "}
            <Code>account_id</Code>. Toggle visibility per-record from the
            dashboard.
          </p>
        </Section>

        <Section id="cors" title="CORS & embedding">
          <p>
            All public endpoints respond with{" "}
            <Code>Access-Control-Allow-Origin: *</Code> and handle{" "}
            <Code>OPTIONS</Code> preflight requests. You can call them
            directly from any browser on any domain — no proxy server needed.
          </p>
        </Section>

        <Section id="caching" title="Caching">
          <p>
            Responses are served with{" "}
            <Code>Cache-Control: public, s-maxage=60, stale-while-revalidate=300</Code>
            . CDNs and browsers cache results for 60 seconds, and may serve
            stale-but-fresh-enough responses for up to 5 minutes while the
            cache revalidates in the background. Updates you make in the
            dashboard typically appear within a minute.
          </p>
        </Section>

        <Section id="errors" title="Errors">
          <p>
            Errors return a JSON body with an <Code>error</Code> field and a
            standard HTTP status code:
          </p>
          <CodeBlock>{`{
  "error": "account_id query parameter is required"
}`}</CodeBlock>
          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Status</Th>
                  <Th>Meaning</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                <Tr>
                  <Td>
                    <Code>400</Code>
                  </Td>
                  <Td>
                    Missing or invalid query parameter (usually{" "}
                    <Code>account_id</Code>).
                  </Td>
                </Tr>
                <Tr>
                  <Td>
                    <Code>404</Code>
                  </Td>
                  <Td>
                    Requested resource not found (account, event, or player
                    slug doesn&apos;t exist or isn&apos;t public).
                  </Td>
                </Tr>
                <Tr>
                  <Td>
                    <Code>500</Code>
                  </Td>
                  <Td>Server-side error. Retry with backoff.</Td>
                </Tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="endpoints" title="Endpoints">
          <p className="mb-6">
            Three endpoints, all <Code>GET</Code>, all under{" "}
            <Code>/api/public</Code>.
          </p>
          <ul className="space-y-2">
            <EndpointSummary
              method="GET"
              path="/api/public/events"
              description="List published events with hosted registration URLs."
              anchor="endpoint-events"
            />
            <EndpointSummary
              method="GET"
              path="/api/public/players"
              description="List public players with profiles, awards, and stats."
              anchor="endpoint-players"
            />
            <EndpointSummary
              method="GET"
              path="/api/public/teams"
              description="List public teams with rosters and staff."
              anchor="endpoint-teams"
            />
          </ul>
        </Section>

        <EndpointSection
          id="endpoint-events"
          method="GET"
          path="/api/public/events"
          description="Returns published events for an account, with a precomputed register_url that points at a hosted Stripe-powered checkout page on the account's branded domain."
        >
          <h3 className="text-lg font-semibold text-gray-900">
            Query parameters
          </h3>
          <ParamTable
            rows={[
              {
                name: "account_id",
                type: "string (UUID)",
                required: true,
                description: "Your account identifier.",
              },
              {
                name: "slug",
                type: "string",
                required: false,
                description:
                  "If provided, returns a single event under an event key. Returns 404 if not found.",
              },
              {
                name: "include_past",
                type: "boolean",
                required: false,
                description:
                  "Pass true to include events whose ends_at is in the past. Defaults to upcoming only.",
              },
            ]}
          />

          <h3 className="mt-6 text-lg font-semibold text-gray-900">
            Response shape
          </h3>
          <CodeBlock>{`{
  "events": [
    {
      "id": "uuid",
      "slug": "summer-camp-2026",
      "name": "Summer Skills Camp",
      "description": "Three-day skills intensive…",
      "location": "Main Gym",
      "starts_at": "2026-07-15T09:00:00Z",
      "ends_at": "2026-07-17T16:00:00Z",
      "registration_opens_at": "2026-05-01T00:00:00Z",
      "registration_closes_at": "2026-07-10T23:59:59Z",
      "capacity": 50,
      "fee_amount": 15000,
      "fee_description": "Per camper",
      "registration_open": true,
      "register_url": "https://yourname.athletes.app/register/summer-camp-2026"
    }
  ]
}`}</CodeBlock>

          <FieldNotes>
            <li>
              <Code>fee_amount</Code> is in the smallest currency unit (cents
              for USD). <Code>15000</Code> = $150.00.
            </li>
            <li>
              <Code>registration_open</Code> is computed server-side based on
              <Code>registration_opens_at</Code> and{" "}
              <Code>registration_closes_at</Code>. Use it to disable buttons in
              your UI.
            </li>
            <li>
              <Code>register_url</Code> resolves to the account&apos;s custom
              domain when one is configured, falling back to{" "}
              <Code>{"{subdomain}.athletes.app"}</Code>. Always link to it
              as-is — don&apos;t reconstruct the URL yourself.
            </li>
            <li>
              When <Code>slug</Code> is provided the response key is{" "}
              <Code>event</Code> (singular) instead of <Code>events</Code>.
            </li>
          </FieldNotes>

          <h3 className="mt-6 text-lg font-semibold text-gray-900">Example</h3>
          <CodeBlock>{`curl 'https://athletes.app/api/public/events?account_id=YOUR_ACCOUNT_ID'`}</CodeBlock>
        </EndpointSection>

        <EndpointSection
          id="endpoint-players"
          method="GET"
          path="/api/public/players"
          description="Returns players currently rostered on public, active, varsity teams, including their profile data, awards, and season stats."
        >
          <h3 className="text-lg font-semibold text-gray-900">
            Query parameters
          </h3>
          <ParamTable
            rows={[
              {
                name: "account_id",
                type: "string (UUID)",
                required: true,
                description: "Your account identifier.",
              },
              {
                name: "slug",
                type: "string",
                required: false,
                description:
                  "If provided, returns a single player under a player key. Returns 404 if not found.",
              },
              {
                name: "award",
                type: "string",
                required: false,
                description:
                  "Filter to players who hold an award with this slug (e.g. all-conference).",
              },
            ]}
          />

          <h3 className="mt-6 text-lg font-semibold text-gray-900">
            Response shape
          </h3>
          <CodeBlock>{`{
  "players": [
    {
      "id": "uuid",
      "slug": "marcus-johnson",
      "first_name": "Marcus",
      "last_name": "Johnson",
      "name": "Marcus Johnson",
      "photo": "https://…",
      "height": "6'3\\"",
      "weight_lbs": 185,
      "grad_year": 2027,
      "hometown": "Provo, UT",
      "bio": "Three-year varsity guard…",
      "instagram": "marcus.j",
      "twitter": "marcusj",
      "hudl_url": "https://hudl.com/…",
      "teams": [
        {
          "id": "uuid",
          "name": "Boys Varsity Basketball",
          "slug": "boys-varsity",
          "icon": "https://…",
          "jersey_number": 23,
          "position": "Guard",
          "grade": "Junior",
          "season_bio": "…",
          "photo": "https://…",
          "awards": [
            { "title": "All-Conference First Team", "slug": "all-conference", "category": "individual" }
          ]
        }
      ],
      "stats": [
        {
          "season_label": "2025-26",
          "class_label": "Junior",
          "gp": 24,
          "ppg": 18.4,
          "rpg": 6.1,
          "apg": 4.2,
          "spg": 1.8,
          "bpg": 0.4,
          "fg_pct": 0.487,
          "three_pct": 0.382,
          "ft_pct": 0.812,
          "is_career_total": false
        }
      ]
    }
  ]
}`}</CodeBlock>

          <FieldNotes>
            <li>
              Players appear once and aggregate every public team they&apos;re
              rostered on under the <Code>teams</Code> array.
            </li>
            <li>
              <Code>stats.is_career_total</Code> is <Code>true</Code> for
              all-time career totals, <Code>false</Code> for individual season
              rows.
            </li>
            <li>
              Shooting percentages (<Code>fg_pct</Code>, <Code>three_pct</Code>,{" "}
              <Code>ft_pct</Code>) are decimals — multiply by 100 to display.
            </li>
            <li>
              When <Code>slug</Code> is provided the response key is{" "}
              <Code>player</Code> (singular).
            </li>
          </FieldNotes>

          <h3 className="mt-6 text-lg font-semibold text-gray-900">Example</h3>
          <CodeBlock>{`curl 'https://athletes.app/api/public/players?account_id=YOUR_ACCOUNT_ID&award=all-conference'`}</CodeBlock>
        </EndpointSection>

        <EndpointSection
          id="endpoint-teams"
          method="GET"
          path="/api/public/teams"
          description="Returns public, active, varsity teams with their full roster and coaching staff embedded."
        >
          <h3 className="text-lg font-semibold text-gray-900">
            Query parameters
          </h3>
          <ParamTable
            rows={[
              {
                name: "account_id",
                type: "string (UUID)",
                required: true,
                description: "Your account identifier.",
              },
            ]}
          />

          <h3 className="mt-6 text-lg font-semibold text-gray-900">
            Response shape
          </h3>
          <CodeBlock>{`{
  "teams": [
    {
      "id": "uuid",
      "name": "Boys Varsity Basketball",
      "level": "varsity",
      "icon": "https://…",
      "slug": "boys-varsity",
      "awards": [
        { "title": "Region Champions 2025" }
      ],
      "staff": [
        {
          "id": "uuid",
          "slug": "coach-smith",
          "first_name": "John",
          "last_name": "Smith",
          "name": "John Smith",
          "photo": "https://…"
        }
      ],
      "players": [
        {
          "id": "uuid",
          "slug": "marcus-johnson",
          "first_name": "Marcus",
          "last_name": "Johnson",
          "name": "Marcus Johnson",
          "photo": "https://…",
          "height": "6'3\\"",
          "weight_lbs": 185,
          "grad_year": 2027,
          "hometown": "Provo, UT",
          "bio": "…",
          "season_bio": "…",
          "jersey_number": 23,
          "position": "Guard",
          "grade": "Junior",
          "awards": [{ "title": "All-Conference" }],
          "teams": [
            { "id": "uuid", "name": "Boys Varsity Basketball", "slug": "boys-varsity" }
          ]
        }
      ]
    }
  ]
}`}</CodeBlock>

          <FieldNotes>
            <li>
              Only varsity, active, public teams are returned. Sub-varsity and
              private teams stay hidden.
            </li>
            <li>
              Each player&apos;s <Code>teams</Code> array includes every public
              team they&apos;re also on, so you can show cross-team
              affiliations.
            </li>
            <li>
              Use <Code>/api/public/players</Code> instead if you want season
              stats — the teams endpoint omits stats for payload size.
            </li>
          </FieldNotes>

          <h3 className="mt-6 text-lg font-semibold text-gray-900">Example</h3>
          <CodeBlock>{`curl 'https://athletes.app/api/public/teams?account_id=YOUR_ACCOUNT_ID'`}</CodeBlock>
        </EndpointSection>

        <Section id="examples" title="Code examples">
          <h3 className="text-lg font-semibold text-gray-900">
            Browser / JavaScript
          </h3>
          <CodeBlock>{`const ACCOUNT_ID = "00000000-0000-0000-0000-000000000000"

const res = await fetch(
  \`https://athletes.app/api/public/events?account_id=\${ACCOUNT_ID}\`
)
const { events } = await res.json()

for (const event of events) {
  console.log(event.name, event.register_url)
}`}</CodeBlock>

          <h3 className="mt-6 text-lg font-semibold text-gray-900">
            React component
          </h3>
          <CodeBlock>{`import { useEffect, useState } from "react"

const ACCOUNT_ID = "00000000-0000-0000-0000-000000000000"

export function UpcomingEvents() {
  const [events, setEvents] = useState([])

  useEffect(() => {
    fetch(\`https://athletes.app/api/public/events?account_id=\${ACCOUNT_ID}\`)
      .then((r) => r.json())
      .then((data) => setEvents(data.events))
  }, [])

  return (
    <ul>
      {events.map((event) => (
        <li key={event.id}>
          <strong>{event.name}</strong>
          {event.registration_open && (
            <a href={event.register_url}> Register →</a>
          )}
        </li>
      ))}
    </ul>
  )
}`}</CodeBlock>

          <h3 className="mt-6 text-lg font-semibold text-gray-900">
            Server-side (Node)
          </h3>
          <CodeBlock>{`const ACCOUNT_ID = process.env.ATHLETES_APP_ACCOUNT_ID

const res = await fetch(
  \`https://athletes.app/api/public/players?account_id=\${ACCOUNT_ID}\`,
  { next: { revalidate: 60 } } // Next.js ISR
)
const { players } = await res.json()`}</CodeBlock>

          <h3 className="mt-6 text-lg font-semibold text-gray-900">
            Embed a registration link in HTML
          </h3>
          <p>
            For the simplest case — linking to a single event from a static
            site — skip the API entirely. Use the registration URL directly:
          </p>
          <CodeBlock>{`<a href="https://yourname.athletes.app/register/summer-camp-2026">
  Register for Summer Camp →
</a>`}</CodeBlock>
          <p>
            Or use <Code>/api/public/events?slug=summer-camp-2026</Code> to
            fetch metadata first if you want to show the price, capacity, or
            disable the link when registration is closed.
          </p>
        </Section>

        <Section id="changelog" title="Changelog">
          <ul className="space-y-3">
            <ChangelogEntry date="2026-04-28">
              Added <Code>GET /api/public/events</Code> with{" "}
              <Code>register_url</Code> for hosted checkout embedding.
            </ChangelogEntry>
            <ChangelogEntry date="Earlier">
              Initial release of <Code>GET /api/public/players</Code> and{" "}
              <Code>GET /api/public/teams</Code>.
            </ChangelogEntry>
          </ul>
        </Section>

        <div className="mt-16 rounded-2xl border border-blue-200 bg-blue-50 p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Need an endpoint we don&apos;t have?
          </h2>
          <p className="mt-2 text-gray-600">
            Email us and we&apos;ll usually ship it within a week.
          </p>
          <div className="mt-6">
            <Link
              href="/demo"
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Talk to us
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="mb-16 scroll-mt-24">
      <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        <a href={`#${id}`} className="hover:text-blue-600">
          {title}
        </a>
      </h2>
      <div className="prose prose-gray mt-4 max-w-none text-base leading-relaxed text-gray-700">
        {children}
      </div>
    </section>
  )
}

function EndpointSection({
  id,
  method,
  path,
  description,
  children,
}: {
  id: string
  method: string
  path: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="mb-16 scroll-mt-24 rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-green-100 px-2.5 py-1 text-xs font-bold uppercase text-green-800">
          {method}
        </span>
        <code className="font-mono text-base font-semibold text-gray-900">
          {path}
        </code>
        <a
          href={`#${id}`}
          aria-label={`Link to ${path}`}
          className="text-gray-400 hover:text-blue-600"
        >
          #
        </a>
      </div>
      <p className="mt-3 text-base text-gray-600">{description}</p>
      <div className="mt-6 text-base leading-relaxed text-gray-700">
        {children}
      </div>
    </section>
  )
}

function EndpointSummary({
  method,
  path,
  description,
  anchor,
}: {
  method: string
  path: string
  description: string
  anchor: string
}) {
  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm">
      <a href={`#${anchor}`} className="block">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-bold uppercase text-green-800">
            {method}
          </span>
          <code className="font-mono text-sm font-semibold text-gray-900">
            {path}
          </code>
          <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
        </div>
        <p className="mt-1.5 text-sm text-gray-600">{description}</p>
      </a>
    </li>
  )
}

interface ParamRow {
  name: string
  type: string
  required: boolean
  description: string
}

function ParamTable({ rows }: { rows: ParamRow[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-white">
          <tr>
            <Th>Parameter</Th>
            <Th>Type</Th>
            <Th>Required</Th>
            <Th>Description</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {rows.map((row) => (
            <Tr key={row.name}>
              <Td>
                <Code>{row.name}</Code>
              </Td>
              <Td>{row.type}</Td>
              <Td>
                {row.required ? (
                  <span className="font-medium text-red-600">required</span>
                ) : (
                  <span className="text-gray-500">optional</span>
                )}
              </Td>
              <Td>{row.description}</Td>
            </Tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FieldNotes({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
      <p className="text-sm font-semibold text-blue-900">Notes</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
        {children}
      </ul>
    </div>
  )
}

function ChangelogEntry({
  date,
  children,
}: {
  date: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-4">
      <span className="w-24 flex-shrink-0 text-sm font-mono text-gray-500">
        {date}
      </span>
      <span>{children}</span>
    </li>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.875em] text-gray-900">
      {children}
    </code>
  )
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm leading-relaxed text-gray-100">
      <code className="font-mono">{children}</code>
    </pre>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2.5 align-top text-gray-700">{children}</td>
}

function Tr({ children }: { children: React.ReactNode }) {
  return <tr>{children}</tr>
}

function TocLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <li>
      <a href={href} className="text-blue-600 hover:underline">
        {children}
      </a>
    </li>
  )
}
