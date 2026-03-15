"use client";

import { Users, Mail, Receipt, DollarSign, Shield, Activity, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DashboardClientProps {
  profile: any;
  stats: {
    totalTeams: number;
    activeTeams: number;
    totalPeople: number;
    totalDependents: number;
    totalPrimaryContacts: number;
    totalRosterSpots: number;
    totalStaff: number;
    totalInvoices: number;
    totalInvoiceAmount: number;
    paidInvoices: number;
    paidAmount: number;
    pendingAmount: number;
    totalEmailsSent: number;
    recentActivity: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      timestamp: string;
      link?: string;
    }>;
  };
  account: any;
}

export function DashboardClient({ profile, stats, account }: DashboardClientProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back, {profile?.first_name || profile?.email}
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening with your organization
            </p>
          </div>
        </div>
      </div>

      {/* Main Statistics Grid */}
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
              ${stats.paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              ${stats.totalInvoiceAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} total billed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => router.push("/people")}
            >
              <Users className="mr-2 h-4 w-4" />
              View All People
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => router.push("/teams")}
            >
              <Users className="mr-2 h-4 w-4" />
              Manage Teams
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => router.push("/invoices")}
            >
              <Receipt className="mr-2 h-4 w-4" />
              View Invoices
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => router.push("/settings")}
            >
              <Activity className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates from your organization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((activity) => (
                  <div key={activity.id} className={`flex items-start gap-3 ${activity.link ? 'cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-2 rounded-lg transition-colors' : ''}`} onClick={() => activity.link && router.push(activity.link)}>
                    <div className={`mt-1 rounded-full p-2 ${
                      activity.type === 'team' 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'bg-purple-100 text-purple-600'
                    }`}>
                      {activity.type === 'team' ? (
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

      {/* Financial Overview */}
      {stats.totalInvoices > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Financial Overview</CardTitle>
            <CardDescription>Revenue and payment tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Billed</p>
                <p className="text-2xl font-bold">
                  ${stats.totalInvoiceAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Collected</p>
                <p className="text-2xl font-bold text-green-600">
                  ${stats.paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.paidInvoices} of {stats.totalInvoices} invoices
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Outstanding</p>
                <p className="text-2xl font-bold text-yellow-600">
                  ${stats.pendingAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.totalInvoices - stats.paidInvoices} pending
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
