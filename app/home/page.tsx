import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Users,
  Trophy,
  Globe,
  CalendarCheck,
  Mail,
  CreditCard,
  ArrowRight,
  Check,
} from "lucide-react"

export default function Home() {
  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 sm:pb-28 sm:pt-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
              The CRM built for sports programs
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Run your entire program from one place.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 sm:text-xl">
              Athletes App is the all-in-one platform for coaches and clubs to
              manage rosters, run camps, send emails, take payments, and
              publish a program website — without juggling five different
              tools.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/demo">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                  Schedule a Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Sign In
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Built for high schools, club programs, and youth sports.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything your program runs on, in one app.
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Stop stitching together spreadsheets, MailChimp, Eventbrite, and
              a website builder. Athletes App replaces all of them.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Users className="h-6 w-6" />}
              title="Athlete & contact CRM"
              description="One profile per athlete, with parents, alumni, and staff linked. Track contact info, relationships, and history without losing anyone in a spreadsheet."
            />
            <FeatureCard
              icon={<Trophy className="h-6 w-6" />}
              title="Teams, rosters & awards"
              description="Build teams by season, assign jersey numbers and positions, and record team and individual awards as you go. Multi-year history stays attached to each player."
            />
            <FeatureCard
              icon={<Globe className="h-6 w-6" />}
              title="Your program's public website"
              description="Every account gets yourname.athletes.app — or bring your own domain. Player and team pages auto-publish with photos, stats, and awards. Embed feeds on existing sites via our public API."
            />
            <FeatureCard
              icon={<CalendarCheck className="h-6 w-6" />}
              title="Camps, clinics & events"
              description="Publish events with capacity, registration windows, and a fee. Parents register and pay on a hosted checkout page. Drop a registration link anywhere — your school site, social bio, or a flyer."
            />
            <FeatureCard
              icon={<Mail className="h-6 w-6" />}
              title="Email broadcasts & lists"
              description="Send announcements, newsletters, and event updates from your own domain. Build lists, segment by team or season, and see opens, clicks, and bounces in real time."
            />
            <FeatureCard
              icon={<CreditCard className="h-6 w-6" />}
              title="Invoicing & Stripe payments"
              description="Bill team fees, dues, and merchandise directly through Stripe. Customers pay with a card; you see who's paid and who's outstanding without chasing receipts."
            />
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Public profiles
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                A recruiting-ready site for every player.
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                The roster you maintain in the dashboard becomes your public
                site automatically. Coaches share player pages with college
                recruiters. Parents share with family. You don't lift a
                finger.
              </p>
              <ul className="mt-8 space-y-4">
                <BenefitItem>
                  Custom subdomain or your own CNAME — fully branded.
                </BenefitItem>
                <BenefitItem>
                  Player pages with photo, height, grad year, hometown, stats,
                  highlight links, and awards.
                </BenefitItem>
                <BenefitItem>
                  Public JSON API to embed players, teams, and events on your
                  existing school or club website.
                </BenefitItem>
                <BenefitItem>
                  Privacy controls per player — toggle visibility without
                  deleting data.
                </BenefitItem>
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
              <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-8">
                <div className="space-y-4">
                  <div className="rounded-lg bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-blue-200" />
                      <div>
                        <div className="font-semibold text-gray-900">
                          Marcus Johnson
                        </div>
                        <div className="text-sm text-gray-500">
                          Class of 2027 · 6&apos;3&quot; · Guard
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <StatTile label="PPG" value="18.4" />
                    <StatTile label="RPG" value="6.1" />
                    <StatTile label="APG" value="4.2" />
                  </div>
                  <div className="rounded-lg bg-white p-3 text-xs text-gray-500 shadow-sm">
                    All-Conference First Team · Team Captain
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Events &amp; payments
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              From flyer to paid in three clicks.
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Selling out a summer camp shouldn&apos;t require Eventbrite, a
              Google Form, and a Venmo request.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            <Step
              number="1"
              title="Create the event"
              description="Set your fee, capacity, location, and registration window. Publish in seconds."
            />
            <Step
              number="2"
              title="Share the link"
              description="A hosted registration page on your subdomain — drop the URL on Instagram, in an email, or on your school site."
            />
            <Step
              number="3"
              title="Get paid"
              description="Stripe handles the card. You see registrations, payments, and capacity in real time."
            />
          </div>
        </div>
      </section>

      <section className="bg-blue-600">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Ready to retire the spreadsheet?
              </h2>
              <p className="mt-4 text-lg text-blue-100">
                See how Athletes App fits your program. Bring your roster
                — we&apos;ll show you what your site, registration page, and
                inbox can look like in under 30 minutes.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link href="/demo">
                <Button
                  size="lg"
                  className="bg-white text-blue-700 hover:bg-blue-50"
                >
                  Schedule a Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/portal">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white bg-transparent text-white hover:bg-blue-700"
                >
                  Billing Portal
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 transition hover:border-blue-200 hover:shadow-md">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        {description}
      </p>
    </div>
  )
}

function BenefitItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
      <span className="text-gray-700">{children}</span>
    </li>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3 text-center shadow-sm">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
    </div>
  )
}

function Step({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="relative">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
        {number}
      </div>
      <h3 className="mt-5 text-xl font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-base text-gray-600">{description}</p>
    </div>
  )
}
