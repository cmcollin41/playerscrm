"use client"

import { Users, Mail, Receipt, Activity } from "lucide-react"
import { useRouter } from "next/navigation"
import { Bar, BarChart, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"

import { Eyebrow, StatTile } from "@/components/ui/sports-ui"

const revenueChartConfig = {
  collected: {
    // emerald-500
    label: "Collected",
    color: "hsl(160, 84%, 39%)",
  },
  outstanding: {
    // amber-500
    label: "Outstanding",
    color: "hsl(38, 92%, 50%)",
  },
} satisfies ChartConfig

interface DashboardClientProps {
  profile: any
  stats: {
    totalTeams: number
    activeTeams: number
    totalPeople: number
    totalDependents: number
    totalPrimaryContacts: number
    totalRosterSpots: number
    totalStaff: number
    totalInvoices: number
    totalInvoiceAmount: number
    paidInvoices: number
    paidAmount: number
    pendingAmount: number
    totalEmailsSent: number
    monthlyRevenue: Array<{
      month: string
      collected: number
      outstanding: number
    }>
    recentActivity: Array<{
      id: string
      type: string
      title: string
      description: string
      timestamp: string
      link?: string
    }>
  }
  account: any
}

function formatDollars(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function DashboardClient({ profile, stats, account }: DashboardClientProps) {
  const router = useRouter()

  const collectionRate = stats.totalInvoices > 0
    ? Math.round((stats.paidInvoices / stats.totalInvoices) * 100)
    : 0

  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <Eyebrow>Dashboard</Eyebrow>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-gray-900 sm:text-5xl">
          Welcome back, {profile?.first_name || profile?.email}.
        </h1>
        <p className="mt-2 text-base text-gray-600">
          Here&apos;s what&apos;s happening with your program.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Teams"
          value={stats.totalTeams}
          hint={`${stats.activeTeams} active`}
        />
        <StatTile
          label="People"
          value={stats.totalPeople}
          hint={`${stats.totalPrimaryContacts} contacts · ${stats.totalDependents} dependents`}
        />
        <StatTile
          label="Invoices"
          value={stats.totalInvoices}
          hint={`${stats.paidInvoices} paid`}
        />
        <StatTile
          label="Revenue"
          tone="emerald"
          value={formatDollars(stats.paidAmount)}
          hint={`${formatDollars(stats.totalInvoiceAmount)} total billed`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Financial Overview</CardTitle>
            <CardDescription>Revenue and payment tracking</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.monthlyRevenue.length > 0 ? (
              <ChartContainer config={revenueChartConfig} className="aspect-auto h-[220px] w-full">
                <BarChart data={stats.monthlyRevenue} margin={{ left: 12, right: 12 }}>
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    tickFormatter={(v) => `$${v}`}
                    width={60}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatDollars(Number(value))}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar
                    dataKey="collected"
                    fill="var(--color-collected)"
                    stackId="revenue"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="outstanding"
                    fill="var(--color-outstanding)"
                    stackId="revenue"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                No invoice data yet
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Total billed
                </p>
                <p className="font-display text-xl text-gray-900">
                  {formatDollars(stats.totalInvoiceAmount)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Collected
                </p>
                <p className="font-display text-xl text-emerald-700">
                  {formatDollars(stats.paidAmount)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Outstanding
                </p>
                <p className="font-display text-xl text-amber-700">
                  {formatDollars(stats.pendingAmount)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Collection rate
                </p>
                <p className="font-display text-xl text-gray-900">{collectionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates from your organization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className={`flex items-start gap-3 ${activity.link ? "cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-2 rounded-lg transition-colors" : ""}`}
                    onClick={() => activity.link && router.push(activity.link)}
                  >
                    <div className={`mt-1 rounded-full p-2 ${
                      activity.type === "team"
                        ? "bg-orange-50 text-orange-600"
                        : "bg-blue-50 text-blue-600"
                    }`}>
                      {activity.type === "team" ? (
                        <Users className="h-4 w-4" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {activity.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {activity.description}
                      </p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                      {activity.type}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    No recent activity
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
