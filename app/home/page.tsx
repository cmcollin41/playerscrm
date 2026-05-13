import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { MobileActivityTicker } from "./mobile-activity-ticker"
import {
  ArrowRight,
  Check,
  CreditCard,
  ClipboardList,
  Baby,
  GraduationCap,
  UserPlus,
  Mail,
  DollarSign,
  CalendarCheck,
} from "lucide-react"

export default function Home() {
  return (
    <div className="bg-white text-gray-900">
      <Hero />
      <FeatureSection />
      <AudienceSection />
      <PricingTeaser />
      <FaqSection />
      <FinalCta />
    </div>
  )
}

// =============================================================================
// Hero
// =============================================================================
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-gray-100 bg-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-orange-50 via-white to-white" />
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-7">
          <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-700">
            Built for sports programs
          </span>
          <h1 className="mt-6 font-display text-5xl leading-[0.95] tracking-tight text-gray-900 sm:text-6xl lg:text-7xl xl:text-8xl">
            The operating system for your{" "}
            <span className="text-orange-600">sports program.</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-gray-600 sm:text-xl">
            Rosters, events, payments, your program&apos;s website, and parent
            communications — in one place, built specifically for the way
            sports programs actually run.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/demo">
              <Button
                size="lg"
                className="bg-gray-900 px-6 text-base font-semibold hover:bg-gray-800"
              >
                Schedule a demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="px-6 text-base font-semibold"
              >
                Sign in
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-gray-500">
            For club programs, high schools, and youth sports — no contracts,
            no setup fees.
          </p>
        </div>
        <div className="lg:col-span-5">
          <HeroMockup />
        </div>
      </div>
    </section>
  )
}

interface HeroActivity {
  icon: React.ReactNode
  accent: string
  delta: string
  label: string
  position: string
}

const HERO_ACTIVITIES: HeroActivity[] = [
  {
    icon: <UserPlus className="h-3.5 w-3.5" />,
    accent: "bg-orange-500",
    delta: "+12",
    label: "registrations today",
    position: "-right-12 -top-8 rotate-[3deg]",
  },
  {
    icon: <CalendarCheck className="h-3.5 w-3.5" />,
    accent: "bg-gray-900",
    delta: "+2",
    label: "events this month",
    position: "-left-16 top-1/4 rotate-[-3deg]",
  },
  {
    icon: <Mail className="h-3.5 w-3.5" />,
    accent: "bg-blue-500",
    delta: "+141",
    label: "emails sent",
    position: "-right-16 top-1/2 -translate-y-1/2 rotate-[2deg]",
  },
  {
    icon: <DollarSign className="h-3.5 w-3.5" />,
    accent: "bg-emerald-500",
    delta: "+38",
    label: "fees paid this week",
    position: "-bottom-10 -left-14 rotate-[-4deg]",
  },
]

function HeroMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-orange-100/60 via-blue-100/40 to-transparent blur-2xl" />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xl ring-1 ring-black/5">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-50 p-1.5">
            <Image
              src="https://zkoxnmdrhgbjovfvparc.supabase.co/storage/v1/object/public/logos/provo-bulldog.svg"
              width={48}
              height={48}
              alt="Provo Basketball Club"
              className="h-full w-full object-contain"
              unoptimized
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg text-gray-900">
              Provo Basketball
            </p>
            <p className="truncate font-mono text-xs text-gray-500">
              provobasketball.athletes.app
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            Live
          </span>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <StatTile label="Teams" value="6" />
          <StatTile label="Players" value="87" />
          <StatTile label="Seasons" value="3" />
        </div>
        <div className="mt-5 space-y-2">
          <RowChip
            label="Varsity Boys · 2026–27"
            value="14 on roster"
            tone="blue"
          />
          <RowChip
            label="Summer Camp 2026"
            value="Registration open"
            tone="emerald"
          />
          <RowChip
            label="Spring League"
            value="$3.2k outstanding"
            tone="amber"
          />
        </div>
      </div>

      {/* Desktop: scattered floating badges around the card */}
      {HERO_ACTIVITIES.map((a) => (
        <div
          key={a.delta + a.label}
          className={`absolute hidden sm:block ${a.position}`}
        >
          <ActivityBadge
            icon={a.icon}
            accent={a.accent}
            delta={a.delta}
            label={a.label}
          />
        </div>
      ))}

      {/* Mobile: single notification below the card that cycles through */}
      <MobileActivityTicker activities={HERO_ACTIVITIES} />
    </div>
  )
}

function ActivityBadge({
  icon,
  accent,
  delta,
  label,
}: {
  icon: React.ReactNode
  accent: string
  delta: string
  label: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-xl ring-1 ring-black/5">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-white ${accent}`}
      >
        {icon}
      </span>
      <div className="leading-tight">
        <p className="font-display text-sm text-gray-900">{delta}</p>
        <p className="text-[10px] text-gray-500">{label}</p>
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-2 py-3">
      <div className="font-display text-2xl text-gray-900">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
    </div>
  )
}

function RowChip({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "blue" | "emerald" | "amber"
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  } as const
  return (
    <div className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-xs">
      <span className="font-medium text-gray-700">{label}</span>
      <span
        className={`rounded px-2 py-0.5 text-[10px] font-semibold ${tones[tone]}`}
      >
        {value}
      </span>
    </div>
  )
}

// =============================================================================
// Features (alternating left/right blocks)
// =============================================================================
function FeatureSection() {
  return (
    <section
      id="features"
      className="border-b border-gray-100 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">
            What it does
          </p>
          <h2 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-gray-900 sm:text-5xl">
            Every tool your program needs.
            <br />
            <span className="text-gray-400">Without the duct tape.</span>
          </h2>
          <p className="mt-5 text-lg text-gray-600">
            Stop stitching spreadsheets, Eventbrite, MailChimp, and a website
            builder. One platform, one source of truth.
          </p>
        </div>

        <div className="mt-20 space-y-24 sm:space-y-32">
          <FeatureBlock
            eyebrow="Athlete CRM"
            title="Every athlete, parent, and alum — in one place."
            description="One profile per athlete, with parents, dependents, and history attached. Tags, lists, and search built for the way programs actually segment people."
            bullets={[
              "Multi-year history attached to each player",
              "Guardians, dependents, and alumni linked together",
              "Tag, list, and segment for emails and events",
            ]}
            mockup={<RosterMockup />}
          />
          <FeatureBlock
            reverse
            eyebrow="Communications & billing"
            title="Send like a pro. Get paid like one too."
            description="Email broadcasts and transactional emails sent from your own verified domain. Invoices that look like they came from your program — not a third party."
            bullets={[
              "Broadcasts sent from your verified domain",
              "Lists segmented by team, season, or tag",
              "Open, click, and bounce metrics in real time",
              "Stripe invoicing with paid/unpaid tracking",
            ]}
            mockup={<CommsMockup />}
          />
          <FeatureBlock
            eyebrow="Camps, clinics, and events"
            title="From flyer to paid in three clicks."
            description="Publish events with capacity, registration windows, and a fee. Parents register and pay on a hosted page. Drop the link on Instagram, in an email, or on your school site."
            bullets={[
              "Hosted registration page on your subdomain",
              "Stripe-powered payments, with reconciliation built in",
              "Capacity, waitlists, and registration windows",
              "Family discounts and multi-event checkout",
            ]}
            mockup={<EventMockup />}
          />
          <FeatureBlock
            reverse
            eyebrow="Public data & API"
            title="The data layer behind your program's site."
            description="Players, teams, events, and stats — all exposed through a public JSON API. Build your own site, embed feeds into an existing one, or have us build something custom on top. You decide what's public, down to the record."
            bullets={[
              "Public JSON API for players, teams, and events",
              "Multi-year stats per athlete and per team",
              "Per-record privacy controls — opt in only what's shareable",
              "Live example: provobasketball.com runs on this API",
            ]}
            mockup={<ApiMockup />}
          />
        </div>
      </div>
    </section>
  )
}

function FeatureBlock({
  eyebrow,
  title,
  description,
  bullets,
  mockup,
  reverse,
}: {
  eyebrow: string
  title: string
  description: string
  bullets: string[]
  mockup: React.ReactNode
  reverse?: boolean
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-20">
      <div className={`lg:col-span-6 ${reverse ? "lg:order-2" : ""}`}>
        <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">
          {eyebrow}
        </p>
        <h3 className="mt-3 font-display text-3xl leading-[1.05] tracking-tight text-gray-900 sm:text-4xl">
          {title}
        </h3>
        <p className="mt-4 text-lg text-gray-600">{description}</p>
        <ul className="mt-6 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex gap-3">
              <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
              <span className="text-gray-700">{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={`lg:col-span-6 ${reverse ? "lg:order-1" : ""}`}>
        {mockup}
      </div>
    </div>
  )
}

function RosterMockup() {
  const rows = [
    { num: 11, name: "Marcus Johnson", pos: "G", grade: "11" },
    { num: 23, name: "Jalen Carter", pos: "F", grade: "12" },
    { num: 4, name: "Devon Hayes", pos: "G", grade: "10" },
    { num: 32, name: "Theo Ramirez", pos: "C", grade: "12" },
    { num: 8, name: "Connor Webb", pos: "G", grade: "11" },
  ]
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl ring-1 ring-black/5">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <p className="font-display text-lg text-gray-900">Varsity Boys</p>
          <p className="text-xs text-gray-500">2026–27 · 14 athletes</p>
        </div>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
          Active
        </span>
      </div>
      <ul className="mt-4 divide-y divide-gray-100">
        {rows.map((r) => (
          <li
            key={r.num}
            className="flex items-center gap-4 py-2.5 text-sm"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 font-display text-xs text-white">
              {r.num}
            </span>
            <span className="flex-1 font-medium text-gray-900">{r.name}</span>
            <span className="text-xs text-gray-500">
              {r.pos} · Grade {r.grade}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ApiMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-950 shadow-xl ring-1 ring-black/10">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-3 truncate font-mono text-[11px] text-gray-400">
          GET athletes.app/api/public/players?account_id=…
        </span>
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[12px] leading-relaxed text-gray-200">
        <span className="text-gray-500">{`[`}</span>
        {"\n  "}
        <span className="text-gray-500">{`{`}</span>
        {"\n    "}
        <span className="text-emerald-300">{`"name"`}</span>
        <span className="text-gray-500">{`: `}</span>
        <span className="text-orange-300">{`"Marcus Johnson"`}</span>
        <span className="text-gray-500">{`,`}</span>
        {"\n    "}
        <span className="text-emerald-300">{`"slug"`}</span>
        <span className="text-gray-500">{`: `}</span>
        <span className="text-orange-300">{`"marcus-johnson"`}</span>
        <span className="text-gray-500">{`,`}</span>
        {"\n    "}
        <span className="text-emerald-300">{`"grad_year"`}</span>
        <span className="text-gray-500">{`: `}</span>
        <span className="text-blue-300">{`2027`}</span>
        <span className="text-gray-500">{`,`}</span>
        {"\n    "}
        <span className="text-emerald-300">{`"position"`}</span>
        <span className="text-gray-500">{`: `}</span>
        <span className="text-orange-300">{`"Guard"`}</span>
        <span className="text-gray-500">{`,`}</span>
        {"\n    "}
        <span className="text-emerald-300">{`"stats"`}</span>
        <span className="text-gray-500">{`: { `}</span>
        <span className="text-emerald-300">{`"ppg"`}</span>
        <span className="text-gray-500">{`: `}</span>
        <span className="text-blue-300">{`18.4`}</span>
        <span className="text-gray-500">{`, `}</span>
        <span className="text-emerald-300">{`"rpg"`}</span>
        <span className="text-gray-500">{`: `}</span>
        <span className="text-blue-300">{`6.1`}</span>
        <span className="text-gray-500">{` },`}</span>
        {"\n    "}
        <span className="text-emerald-300">{`"awards"`}</span>
        <span className="text-gray-500">{`: [`}</span>
        <span className="text-orange-300">{`"All-Conference 1st Team"`}</span>
        <span className="text-gray-500">{`]`}</span>
        {"\n  "}
        <span className="text-gray-500">{`}`}</span>
        {"\n"}
        <span className="text-gray-500">{`]`}</span>
      </pre>
      <div className="border-t border-white/10 bg-white/5 px-4 py-2.5 text-[11px] text-gray-400">
        Drop into any framework, or have us build the site for you.
      </div>
    </div>
  )
}

function EventMockup() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl ring-1 ring-black/5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">
            Summer camp
          </p>
          <p className="mt-1 font-display text-2xl text-gray-900">
            Skills Academy 2026
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Jun 10–14 · Provo Recreation Center
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
          Open
        </span>
      </div>
      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2.5 text-xs">
          <span className="text-gray-600">Capacity</span>
          <span className="font-medium text-gray-900">42 / 60</span>
        </div>
        <div className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2.5 text-xs">
          <span className="text-gray-600">Fee</span>
          <span className="font-display text-base text-gray-900">$185</span>
        </div>
        <div className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2.5 text-xs">
          <span className="text-gray-600">Family discount</span>
          <span className="font-medium text-emerald-700">
            $25 off second child
          </span>
        </div>
      </div>
      <button className="mt-5 w-full rounded-md bg-gray-900 py-2.5 text-sm font-semibold text-white">
        Register & pay — $185
      </button>
    </div>
  )
}

function CommsMockup() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xl ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 text-xs">
          <div>
            <p className="font-semibold text-gray-900">Camp registration is open</p>
            <p className="mt-0.5 text-gray-500">
              coach@yourprogram.athletes.app · to All Parents (218)
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
            Sent
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Metric label="Delivered" value="216" />
          <Metric label="Opened" value="184" />
          <Metric label="Clicked" value="71" />
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xl ring-1 ring-black/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-lg text-gray-900">$4,210</p>
            <p className="text-xs text-gray-500">paid this week</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-gray-50 px-2 py-2">
      <div className="font-display text-lg text-gray-900">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
    </div>
  )
}

// =============================================================================
// Audience tiles
// =============================================================================
function AudienceSection() {
  return (
    <section className="bg-gray-950 py-24 text-white sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-orange-400">
            Who it&apos;s for
          </p>
          <h2 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            One platform.{" "}
            <span className="text-gray-500">Three audiences.</span>
          </h2>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          <AudienceTile
            icon={<ClipboardList className="h-6 w-6" />}
            title="For coaches & programs"
            description="Run your roster, your fees, your camps, and your website from one app. Less admin, more coaching."
            points={[
              "Multi-team, multi-season roster management",
              "Email parents from your own domain",
              "Reports and exports for the board",
            ]}
          />
          <AudienceTile
            icon={<GraduationCap className="h-6 w-6" />}
            title="For athletes"
            description="Your stats, awards, and history live in one place — and your program can publish them wherever they want, via API. Always current, always yours."
            points={[
              "Multi-year stats and awards",
              "Highlight links & social",
              "Per-record privacy controls",
            ]}
          />
          <AudienceTile
            icon={<Baby className="h-6 w-6" />}
            title="For parents"
            description="One portal for every kid you have in the program. See their teams, their events, and what you owe — without digging through email."
            points={[
              "Magic-link sign in, no passwords",
              "Every dependent in one view",
              "Pay invoices in two clicks",
            ]}
          />
        </div>
      </div>
    </section>
  )
}

function AudienceTile({
  icon,
  title,
  description,
  points,
}: {
  icon: React.ReactNode
  title: string
  description: string
  points: string[]
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-orange-500/20 text-orange-300">
        {icon}
      </span>
      <h3 className="mt-5 font-display text-xl leading-tight">{title}</h3>
      <p className="mt-3 text-sm text-gray-400">{description}</p>
      <ul className="mt-5 space-y-2">
        {points.map((p) => (
          <li key={p} className="flex gap-2 text-sm text-gray-300">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-400" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// =============================================================================
// Pricing teaser
// =============================================================================
function PricingTeaser() {
  return (
    <section
      id="pricing"
      className="border-b border-gray-100 bg-white py-24 sm:py-32"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">
            Pricing
          </p>
          <h2 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-gray-900 sm:text-5xl">
            One price.{" "}
            <span className="text-gray-400">Every feature.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
            No seat fees, no setup fees, no per-athlete fees. Every program
            gets the full platform for one flat rate — payments are billed
            separately as a small fee per transaction.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-2xl">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5">
            <div className="grid grid-cols-1 gap-0 md:grid-cols-5">
              <div className="bg-gray-950 p-8 text-white md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                  Athletes App
                </p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-6xl leading-none">
                    $99
                  </span>
                  <span className="text-sm text-gray-400">/ year</span>
                </div>
                <p className="mt-2 text-sm text-gray-400">
                  or <span className="font-semibold text-white">$10/mo</span>{" "}
                  month-to-month
                </p>
                <Link href="/demo" className="mt-8 block">
                  <Button
                    size="lg"
                    className="w-full bg-orange-500 text-base font-semibold hover:bg-orange-400"
                  >
                    Get started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <p className="mt-4 text-xs text-gray-500">
                  Cancel anytime. No long-term contract.
                </p>
              </div>

              <div className="p-8 md:col-span-3">
                <p className="text-sm font-semibold text-gray-900">
                  Everything included
                </p>
                <ul className="mt-4 space-y-2.5">
                  <PriceFeature>Unlimited rosters, teams, and seasons</PriceFeature>
                  <PriceFeature>Custom subdomain + your own CNAME</PriceFeature>
                  <PriceFeature>
                    Verified email sending from your domain
                  </PriceFeature>
                  <PriceFeature>
                    Up to <strong>10,000 broadcast emails / month</strong>
                  </PriceFeature>
                  <PriceFeature>Public JSON API + per-record privacy</PriceFeature>
                  <PriceFeature>Parent magic-link portal</PriceFeature>
                  <PriceFeature>Multi-year stats and awards</PriceFeature>
                  <PriceFeature>Events &amp; hosted registration pages</PriceFeature>
                </ul>
              </div>
            </div>

            <div className="border-t border-gray-100 bg-gray-50 px-8 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Payments
                  </p>
                  <p className="mt-0.5 text-xs text-gray-600">
                    Charged only when money moves through your account.
                  </p>
                </div>
                <p className="font-display text-2xl text-gray-900">
                  $1 + 3%
                  <span className="ml-1 text-sm font-normal text-gray-500">
                    per transaction
                  </span>
                </p>
              </div>
              <p className="mt-3 border-t border-gray-200 pt-3 text-xs text-gray-500">
                Stripe&apos;s standard processing fees (currently 2.9% + $0.30
                in the US) apply on top and go directly to Stripe — they
                aren&apos;t part of the Athletes App fee.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            Need higher email volume, a custom website, or multi-program
            billing?{" "}
            <Link href="/demo" className="text-orange-600 hover:underline">
              Talk to us
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  )
}

function PriceFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm text-gray-700">
      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
      <span>{children}</span>
    </li>
  )
}

// =============================================================================
// FAQ
// =============================================================================
function FaqSection() {
  return (
    <section id="faqs" className="border-b border-gray-100 py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-orange-600">
          FAQ
        </p>
        <h2 className="mt-3 text-center font-display text-4xl leading-[1.05] tracking-tight text-gray-900 sm:text-5xl">
          Common questions.
        </h2>
        <dl className="mt-16 divide-y divide-gray-200 border-y border-gray-200">
          <FaqItem
            q="What sports do you support?"
            a="Basketball is what we built it for first, but the data model is sport-agnostic. Stats fields, roster structures, and award types can be configured per account."
          />
          <FaqItem
            q="Do you host our team website?"
            a="No — we're the data layer, not the website builder. Your program's data lives here and is exposed via a public JSON API. You can build the public site yourself, embed feeds into an existing one, or hire us to build a custom site on top of the API. provobasketball.com is a working example built this way."
          />
          <FaqItem
            q="What about our own email domain?"
            a="Email broadcasts and transactional emails (invoices, registration confirmations) send from your own domain once you verify it through Resend. No DNS, no email."
          />
          <FaqItem
            q="Who handles payments?"
            a="Stripe. You connect a Stripe account and money goes directly to it — we don't hold funds. Refunds, payouts, and tax forms come from Stripe. The Athletes App fee ($1 + 3%) is on top of Stripe's normal processing fees (typically 2.9% + $0.30 in the US), which stay with Stripe."
          />
          <FaqItem
            q="Can parents log in?"
            a="Yes. Parents get a magic-link parent portal with their family, teams, events, and invoices in one place. No password to forget."
          />
          <FaqItem
            q="What about data export?"
            a="Everything's exportable. The public API exposes players, teams, and events as JSON for embedding on your existing site. CSV exports are available for the rest."
          />
        </dl>
      </div>
    </section>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="grid grid-cols-1 gap-3 py-8 lg:grid-cols-12 lg:gap-8">
      <dt className="font-display text-xl leading-snug text-gray-900 lg:col-span-5">
        {q}
      </dt>
      <dd className="text-base leading-relaxed text-gray-600 lg:col-span-7">
        {a}
      </dd>
    </div>
  )
}

// =============================================================================
// Final CTA
// =============================================================================
function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-gray-950 py-24 text-white sm:py-32">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-orange-900/40 via-gray-950 to-gray-950" />
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
          Stop running your program out of a spreadsheet.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
          Bring your roster — we&apos;ll show you the CRM, registration pages,
          parent portal, and API feed your site can run on in under 30
          minutes.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/demo">
            <Button
              size="lg"
              className="bg-orange-500 px-6 text-base font-semibold text-white hover:bg-orange-400"
            >
              Schedule a demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/portal-login">
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent px-6 text-base font-semibold text-white hover:bg-white/10"
            >
              Parent portal
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
