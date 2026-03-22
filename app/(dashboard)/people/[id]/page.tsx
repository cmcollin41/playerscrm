"use client";
import { useState, useEffect, Key, use } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { getAccount, getPrimaryContacts } from "@/lib/fetchers/client";
import {
  CardTitle,
  CardHeader,
  CardContent,
  Card,
  CardDescription,
} from "@/components/ui/card";
import { fullName } from "@/lib/utils";
import { toast } from "sonner";
import { BadgeCheck, Users, Receipt, UserPlus, Globe, BarChart3, RefreshCw } from "lucide-react";
import LoadingCircle from "@/components/icons/loading-circle";
import LoadingDots from "@/components/icons/loading-dots";
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"

import { Button } from "@/components/ui/button";
import PersonSheet from "@/components/modal/person-sheet";
import CreateInvoiceModal from "@/components/modal/create-invoice-modal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrency } from "@/lib/utils"

interface PersonPageProps {
  params: Promise<{ id: string }>
}

// Add this interface for better type safety
interface Team {
  id: string
  name: string
  level?: string
  is_active: boolean
  created_at: string
  jersey_number?: number
  position?: string
  roster_grade?: string
}

const LEVEL_LABELS: Record<string, string> = {
  bantam: "Bantam",
  club: "Club",
  freshman: "Freshman",
  sophomore: "Sophomore",
  jv: "JV",
  varsity: "Varsity",
}

interface Payment {
  id: string;
  created_at: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  payment_method: 'stripe' | 'cash' | 'check' | 'other';
  invoice: {
    id: string;
    invoice_number: string;
    description: string;
    status: 'draft' | 'sent' | 'paid' | 'void' | 'overdue';
    due_date: string;
  };
}

// Add these interfaces
interface Invoice {
  id: string
  created_at: string
  amount: number
  status: string
  due_date: string | null
  invoice_number: string | null
  description: string | null
  payments?: Payment[]
  person?: {
    id: string
    first_name: string
    last_name: string
    dependent: boolean
  }
}


// Add this helper function at the top of your file
function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const groupKey = String(item[key]);
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export default function PersonPage({ params }: PersonPageProps) {
  // Unwrap the params Promise
  const { id } = use(params);
  
  const supabase = createClient();

  const [person, setPerson] = useState<any>(null);
  const [toRelationships, setToRelationships] = useState<any>(null);
  const [fromRelationships, setFromRelationships] = useState<any>(null);
  const [account, setAccount] = useState<any>(null);
  const [profile, setProfile] = useState<boolean>(true);
  const [roster, setRoster] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [payments, setPayments] = useState<any[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [playerStats, setPlayerStats] = useState<any[]>([])
  const [isSyncing, setIsSyncing] = useState(false)

  async function fetchRoster() {
    const { data, error } = await supabase
      .from("rosters")
      .select(`
        *,
        teams (
          id,
          name,
          level,
          is_active,
          created_at
        )
      `)
      .eq("person_id", id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setRoster(data.map((entry) => ({
      ...entry.teams,
      jersey_number: entry.jersey_number,
      position: entry.position,
      roster_grade: entry.grade,
      level: entry.teams?.level,
    })));
  }

  async function fetchPlayerStats() {
    const { data, error } = await supabase
      .from("player_season_stats")
      .select("*")
      .eq("person_id", id)
      .order("is_career_total", { ascending: true })
      .order("season_year_start", { ascending: false })

    if (error) {
      console.error("Error fetching stats:", error)
      return
    }
    setPlayerStats(data || [])
  }

  async function handleSyncStats() {
    setIsSyncing(true)
    try {
      const res = await fetch("/api/maxpreps/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Sync failed")
      }
      const data = await res.json()
      setPlayerStats(data.stats || [])
      toast.success("Stats synced from MaxPreps")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync stats")
    } finally {
      setIsSyncing(false)
    }
  }

  async function handleClearStats() {
    const { error } = await supabase
      .from("player_season_stats")
      .delete()
      .eq("person_id", id)

    if (error) {
      toast.error("Failed to clear stats")
      return
    }
    setPlayerStats([])
    toast.success("Stats cleared")
  }

  // Add this new function to fetch payments
  async function fetchPayments() {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        invoices (
          id,
          invoice_number,
          description,
          status,
          due_date
        )
      `)
      .eq('person_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
      return [];
    }

    return data;
  }

  // Update the fetch function
  useEffect(() => {
    async function fetchAllInvoicesAndPayments() {
      setIsLoadingInvoices(true);
      try {
        // First get all relationships
        const { data: relationships, error: relationshipsError } = await supabase
          .from('relationships')
          .select(`
            *,
            from:person_id(*),
            to:relation_id(*)
          `)
          .or(`person_id.eq.${id},relation_id.eq.${id}`);

        if (relationshipsError) {
          console.error('Error fetching relationships:', relationshipsError);
          return;
        }

        // Get all related person IDs
        const relatedIds = relationships
          ? relationships.map(rel => 
              rel.person_id === id ? rel.relation_id : rel.person_id
            )
          : [];

        // Fetch invoices and payments for all related people
        const { data: invoicesData, error: invoicesError } = await supabase
          .from('invoices')
          .select(`
            *,
            payments (*),
            person:people (
              id,
              first_name,
              last_name,
              dependent
            )
          `)
          .in('person_id', [id, ...relatedIds])
          .order('created_at', { ascending: false });

        if (invoicesError) {
          console.error('Error fetching invoices and payments:', invoicesError);
          toast.error('Failed to load payment history');
          return;
        }

        setInvoices(invoicesData || []);
      } catch (error) {
        console.error('Error:', error);
        toast.error('Failed to load payment history');
      } finally {
        setIsLoadingInvoices(false);
      }
    }

    if (id) {
      fetchAllInvoicesAndPayments();
    }
  }, [id]);

  useEffect(() => {
    if (!id) return; // Guard against undefined id
    
    async function fetchData() {
      setIsLoading(true)
      try {
        const [
          fetchedPerson,
          fetchedToRelationships,
          fetchedFromRelationships,
          fetchedAccount
        ] = await Promise.all([
          fetchPerson(),
          fetchToRelationships(),
          fetchFromRelationships(),
          getAccount(),
          fetchRoster(),
          fetchPayments(),
          fetchPlayerStats()
        ])

        const primaryPeople = await getPrimaryContacts(fetchedPerson)
        const p = await hasProfile({
          ...fetchedPerson,
          primary_contacts: primaryPeople,
        })

        setPerson({ ...fetchedPerson, primary_contacts: primaryPeople })
        setToRelationships(fetchedToRelationships || [])
        setFromRelationships(fetchedFromRelationships || [])
        setAccount(fetchedAccount)
        setProfile(p)
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load person data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [id])

  async function hasProfile(person: any) {
    let email = "";
    if (person.email) {
      email = person.email;
    } else if (person?.primary_contacts[0]?.email) {
      email = person.primary_contacts[0].email;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .single();

    if (error) {
      return false;
    }

    return !!data;
  }

  async function fetchPerson() {
    const { data, error } = await supabase
      .from("people")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    return data;
  }

  async function fetchToRelationships() {
    const { data, error } = await supabase
      .from("relationships")
      .select("*,from:person_id(*),to:relation_id(*)")
      .eq("person_id", id);

    if (error) {
      console.error(error);
      return;
    }

    return data;
  }

  async function fetchFromRelationships() {
    const { data, error } = await supabase
      .from("relationships")
      .select("*,from:person_id(*),to:relation_id(*)")
      .eq("relation_id", id);

    if (error) {
      console.error(error);
      return;
    }

    return data;
  }

  // Calculate statistics
  const stats = {
    totalTeams: roster.length,
    activeTeams: roster.filter(t => t.is_active).length,
    totalInvoices: invoices.length,
    totalAmount: invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
    paidAmount: invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0),
    pendingAmount: invoices
      .filter(inv => inv.status === 'sent')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0),
    relationships: (toRelationships?.length || 0) + (fromRelationships?.length || 0),
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <LoadingCircle />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={person?.photo} alt={person?.name} />
              <AvatarFallback className="text-lg">
                {getInitials(person?.first_name, person?.last_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">
                  {person?.name || fullName(person)}
                </h1>
                {person?.is_public && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Globe className="h-3 w-3 mr-1" />
                    Public
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">{person?.email || "No email on file"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setInvoiceModalOpen(true)}
              variant="outline"
              size="sm"
              className="w-9 p-0"
            >
              <Receipt className="h-4 w-4" />
            </Button>
            <PersonSheet
              person={person}
              fromRelationships={fromRelationships || []}
              mode="edit"
              cta={`Edit ${person?.first_name}`}
              title={`Edit ${person?.first_name}`}
              description="Edit this person"
              account={account}
            />
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
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
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalInvoices} invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <BadgeCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.paidAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              Payments received
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Relationships</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.relationships}</div>
            <p className="text-xs text-muted-foreground">
              Connected people
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="teams" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="teams">
            Teams
          </TabsTrigger>
          <TabsTrigger value="stats">
            Stats
          </TabsTrigger>
          <TabsTrigger value="payments">
            Invoices & Payments
          </TabsTrigger>
          <TabsTrigger value="relationships">
            Relationships
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teams" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Teams ({stats.totalTeams})</CardTitle>
              <CardDescription>
                All teams this person is associated with
              </CardDescription>
            </CardHeader>
            <CardContent>
              {roster.length > 0 ? (
                <div className="space-y-3">
                  {roster.map((team: Team) => (
                    <Link
                      key={team.id}
                      href={`/teams/${team.id}`}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg border transition-colors",
                        "hover:bg-muted/50 hover:border-muted-foreground/25",
                        "group"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            team.is_active ? "bg-green-500" : "bg-gray-300"
                          )} 
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{team.name}</span>
                            {team.level && (
                              <Badge variant="outline" className="text-xs capitalize">
                                {LEVEL_LABELS[team.level] || team.level}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {team.roster_grade && <span>{{ "9": "Freshman", "10": "Sophomore", "11": "Junior", "12": "Senior" }[team.roster_grade] || `Grade ${team.roster_grade}`}</span>}
                            {team.jersey_number != null && <span>#{team.jersey_number}</span>}
                            {team.position && <span>{team.position}</span>}
                            {!team.roster_grade && !team.jersey_number && !team.position && (
                              <span>{team.is_active ? "Active" : "Inactive"}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant={team.is_active ? "default" : "secondary"}>
                        {team.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">No teams found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This person is not on any teams yet
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Season Stats</CardTitle>
                  <CardDescription>
                    {person?.maxpreps_url
                      ? "Stats synced from MaxPreps"
                      : "Add a MaxPreps URL to this person's profile to sync stats"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {playerStats.length > 0 && (
                    <Button
                      onClick={handleClearStats}
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-red-600"
                    >
                      Clear
                    </Button>
                  )}
                  {person?.maxpreps_url && (
                    <Button
                      onClick={handleSyncStats}
                      variant="outline"
                      size="sm"
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <LoadingDots color="black" />
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sync Stats
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {playerStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 pr-4 font-medium">Season</th>
                        <th className="pb-2 pr-4 font-medium">Class</th>
                        <th className="pb-2 pr-2 font-medium text-right">GP</th>
                        <th className="pb-2 pr-2 font-medium text-right">PPG</th>
                        <th className="pb-2 pr-2 font-medium text-right">RPG</th>
                        <th className="pb-2 pr-2 font-medium text-right">APG</th>
                        <th className="pb-2 pr-2 font-medium text-right">SPG</th>
                        <th className="pb-2 pr-2 font-medium text-right">BPG</th>
                        <th className="pb-2 pr-2 font-medium text-right">FG%</th>
                        <th className="pb-2 pr-2 font-medium text-right">3PT%</th>
                        <th className="pb-2 font-medium text-right">FT%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerStats
                        .filter((s) => !s.is_career_total)
                        .map((s) => (
                          <tr key={s.id} className="border-b">
                            <td className="py-2 pr-4">{s.season_label}</td>
                            <td className="py-2 pr-4 text-muted-foreground">{s.class_label || "-"}</td>
                            <td className="py-2 pr-2 text-right">{s.gp ?? "-"}</td>
                            <td className="py-2 pr-2 text-right">{s.ppg ?? "-"}</td>
                            <td className="py-2 pr-2 text-right">{s.rpg ?? "-"}</td>
                            <td className="py-2 pr-2 text-right">{s.apg ?? "-"}</td>
                            <td className="py-2 pr-2 text-right">{s.spg ?? "-"}</td>
                            <td className="py-2 pr-2 text-right">{s.bpg ?? "-"}</td>
                            <td className="py-2 pr-2 text-right">{s.fg_pct != null ? `${s.fg_pct}%` : "-"}</td>
                            <td className="py-2 pr-2 text-right">{s.three_pct != null ? `${s.three_pct}%` : "-"}</td>
                            <td className="py-2 text-right">{s.ft_pct != null ? `${s.ft_pct}%` : "-"}</td>
                          </tr>
                        ))}
                      {playerStats
                        .filter((s) => s.is_career_total)
                        .map((s) => (
                          <tr key={s.id} className="border-t-2 font-semibold">
                            <td className="py-2 pr-4">Career</td>
                            <td className="py-2 pr-4"></td>
                            <td className="py-2 pr-2 text-right">{s.gp ?? "-"}</td>
                            <td className="py-2 pr-2 text-right">{s.ppg ?? "-"}</td>
                            <td className="py-2 pr-2 text-right">{s.rpg ?? "-"}</td>
                            <td className="py-2 pr-2 text-right">{s.apg ?? "-"}</td>
                            <td className="py-2 pr-2 text-right">{s.spg ?? "-"}</td>
                            <td className="py-2 pr-2 text-right">{s.bpg ?? "-"}</td>
                            <td className="py-2 pr-2 text-right">{s.fg_pct != null ? `${s.fg_pct}%` : "-"}</td>
                            <td className="py-2 pr-2 text-right">{s.three_pct != null ? `${s.three_pct}%` : "-"}</td>
                            <td className="py-2 text-right">{s.ft_pct != null ? `${s.ft_pct}%` : "-"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">No stats available</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {person?.maxpreps_url
                      ? 'Click "Sync Stats" to fetch stats from MaxPreps'
                      : "Add a MaxPreps URL in the edit form to get started"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoices & Payments</CardTitle>
              <CardDescription>
                All invoices and payment history
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingInvoices ? (
                <div className="flex justify-center py-12">
                  <LoadingCircle />
                </div>
              ) : invoices.length > 0 ? (
                <div className="space-y-8">
                  {Object.entries(groupBy(invoices, 'person_id' as keyof Invoice)).map(([personId, personInvoices]) => {
                    const invoicePerson = personInvoices[0]?.person;
                    return (
                      <div key={personId} className="space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b">
                          <h3 className="text-base font-semibold">
                            {invoicePerson?.first_name} {invoicePerson?.last_name}
                            {personId === id && (
                              <Badge variant="outline" className="ml-2">Primary</Badge>
                            )}
                          </h3>
                          <div className="text-sm font-medium">
                            Total: {formatCurrency(
                              personInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
                            )}
                          </div>
                        </div>
                        
                        {personInvoices.map((invoice: Invoice) => (
                          <div key={invoice.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                            {/* Invoice Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="font-medium">
                                  {invoice.description || `Invoice #${invoice.invoice_number}`}
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {new Date(invoice.created_at).toLocaleDateString('en-US', {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge 
                                  className={cn(
                                    invoice.status === 'paid' && 'bg-green-100 text-green-800 hover:bg-green-100',
                                    invoice.status === 'sent' && 'bg-blue-100 text-blue-800 hover:bg-blue-100',
                                    invoice.status === 'draft' && 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                                  )}
                                >
                                  {invoice.status}
                                </Badge>
                                <span className="font-semibold">
                                  {formatCurrency(invoice.amount)}
                                </span>
                              </div>
                            </div>

                            {/* Payments Section */}
                            {invoice.payments && invoice.payments.length > 0 && (
                              <div className="mt-3 pt-3 border-t space-y-2">
                                <div className="text-sm font-medium text-muted-foreground mb-2">
                                  Payments
                                </div>
                                {invoice.payments.map((payment: Payment) => (
                                  <div 
                                    key={payment.id} 
                                    className="flex items-center justify-between text-sm bg-muted/50 rounded-md p-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs">
                                        {payment.payment_method}
                                      </Badge>
                                      <span className="text-muted-foreground">
                                        {new Date(payment.created_at).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge 
                                        className={cn(
                                          payment.status === 'succeeded' && 'bg-green-100 text-green-800 hover:bg-green-100',
                                          payment.status === 'pending' && 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
                                          payment.status === 'failed' && 'bg-red-100 text-red-800 hover:bg-red-100'
                                        )}
                                      >
                                        {payment.status}
                                      </Badge>
                                      <span className="font-medium">
                                        {formatCurrency(payment.amount)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">No invoices found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create an invoice to get started
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relationships" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Relationships ({stats.relationships})</CardTitle>
              <CardDescription>
                Family members and related contacts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(toRelationships?.length > 0 || fromRelationships?.length > 0) ? (
                <div className="space-y-3">
                  {toRelationships?.map(
                    (relation: any, i: Key | null | undefined) => (
                      <Link
                        key={i}
                        href={`/people/${relation.to.id}`}
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 hover:border-muted-foreground/25 transition-colors"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm text-muted-foreground">{relation.name} of</span>
                          <span className="font-medium">
                            {relation.to.name || fullName(relation.to)}
                          </span>
                        </div>
                        {relation.primary && (
                          <Badge variant="default">Primary</Badge>
                        )}
                      </Link>
                    ),
                  )}

                  {fromRelationships?.map(
                    (relation: any, i: Key | null | undefined) => (
                      <Link
                        key={i}
                        href={`/people/${relation.from.id}`}
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 hover:border-muted-foreground/25 transition-colors"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm text-muted-foreground">{relation.name} is</span>
                          <span className="font-medium">
                            {relation.from.name || fullName(relation.from)}
                          </span>
                        </div>
                        {relation.primary && (
                          <Badge variant="default">Primary</Badge>
                        )}
                      </Link>
                    ),
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <UserPlus className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">No relationships found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add family members or related contacts
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateInvoiceModal
        person={person}
        account={account}
        open={invoiceModalOpen}
        onOpenChange={setInvoiceModalOpen}
      />
    </div>
  );
}
