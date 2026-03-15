"use client"

import { Users, Mail, Receipt, DollarSign, Activity } from "lucide-react"
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

import { Badge } from "@/components/ui/badge"

const revenueChartConfig = {
  collected: {
    label: "Collected",
    color: "hsl(142, 71%, 45%)",
  },
  outstanding: {
    label: "Outstanding",
    color: "hsl(48, 96%, 53%)",
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
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back, {profile?.first_name || profile?.email}
            </h1>
            <p className="text-muted-foreground">
              Here&apos;s what&apos;s happening with your organization
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Teams</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTeams}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeTeams} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total People</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPeople}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalPrimaryContacts} contacts, {stats.totalDependents} dependents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInvoices}</div>
            <p className="text-xs text-muted-foreground">
              {stats.paidInvoices} paid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatDollars(stats.paidAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDollars(stats.totalInvoiceAmount)} total billed
            </p>
          </CardContent>
        </Card>
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

            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Total Billed</p>
                <p className="text-lg font-bold">
                  {formatDollars(stats.totalInvoiceAmount)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Collected</p>
                <p className="text-lg font-bold text-green-600">
                  {formatDollars(stats.paidAmount)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Outstanding</p>
                <p className="text-lg font-bold text-yellow-600">
                  {formatDollars(stats.pendingAmount)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Collection Rate</p>
                <p className="text-lg font-bold">{collectionRate}%</p>
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
                        ? "bg-blue-100 text-blue-600"
                        : "bg-purple-100 text-purple-600"
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
                    <Badge variant="outline" className="text-xs">
                      {activity.type}
                    </Badge>
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
