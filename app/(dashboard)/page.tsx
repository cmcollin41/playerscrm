import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/fetchers/server";
import { DashboardClient } from "./dashboard-client";

export default async function Dashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const account = await getAccount();

  // Fetch teams with roster counts (newest first for recent activity)
  const { data: teams } = await supabase
    .from("teams")
    .select(
      `
        id,
        name,
        created_at,
        is_active,
        rosters (
          id,
          fees (
            amount,
            payments (
              status,
              amount
            )
          )
        ),
        staff (
          id
        )
      `,
    )
    .eq("account_id", account.id)
    .order("created_at", { ascending: false });

  // Fetch people
  const { data: people } = await supabase
    .from("people")
    .select("id, dependent")
    .eq("account_id", account.id);

  // Fetch invoices
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, amount, status, created_at")
    .eq("account_id", account.id);

  // Fetch recent emails
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: emails } = await supabase
    .from("emails")
    .select("id, subject, created_at")
    .eq("account_id", account.id)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(10);

  // Calculate statistics
  const totalTeams = teams?.length || 0;
  const activeTeams = teams?.filter(t => t.is_active).length || 0;
  const totalPeople = people?.length || 0;
  const totalDependents = people?.filter(p => p.dependent).length || 0;
  const totalPrimaryContacts = totalPeople - totalDependents;
  
  const totalRosterSpots = teams?.reduce((acc, team) => acc + (team.rosters?.length || 0), 0) || 0;
  const totalStaff = teams?.reduce((acc, team) => acc + (team.staff?.length || 0), 0) || 0;
  
  const sentOrPaidInvoices = invoices?.filter(inv => inv.status === 'sent' || inv.status === 'paid') || [];
  const totalInvoices = sentOrPaidInvoices.length;
  const totalInvoiceAmount = sentOrPaidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const paidInvoices = sentOrPaidInvoices.filter(inv => inv.status === 'paid').length;
  const paidAmount = sentOrPaidInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const pendingAmount = totalInvoiceAmount - paidAmount;

  const totalEmailsSent = emails?.length || 0;

  const monthlyMap: Record<string, { month: string; sortKey: string; collected: number; outstanding: number }> = {}
  sentOrPaidInvoices.forEach(inv => {
    const date = new Date(inv.created_at)
    const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    if (!monthlyMap[sortKey]) {
      monthlyMap[sortKey] = { month: monthLabel, sortKey, collected: 0, outstanding: 0 }
    }
    if (inv.status === 'paid') {
      monthlyMap[sortKey].collected += inv.amount || 0
    } else {
      monthlyMap[sortKey].outstanding += inv.amount || 0
    }
  })
  const monthlyRevenue = Object.values(monthlyMap)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ month, collected, outstanding }) => ({ month, collected, outstanding }))

  // Get recent activity
  const recentActivity = [
    ...(teams?.slice(0, 3).map((team) => ({
      id: team.id,
      type: "team",
      title: team.name,
      description: `${team.rosters?.length || 0} players, ${team.staff?.length || 0} staff`,
      timestamp: team.created_at,
      link: `/teams/${team.id}`,
    })) || []),
    ...(emails?.slice(0, 5).map((email) => ({
      id: email.id,
      type: "email",
      title: email.subject || "Email sent",
      description: new Date(email.created_at).toLocaleDateString(),
      timestamp: email.created_at,
    })) || []),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  const stats = {
    totalTeams,
    activeTeams,
    totalPeople,
    totalDependents,
    totalPrimaryContacts,
    totalRosterSpots,
    totalStaff,
    totalInvoices,
    totalInvoiceAmount,
    paidInvoices,
    paidAmount,
    pendingAmount,
    totalEmailsSent,
    monthlyRevenue,
    recentActivity,
  };

  const profile = {
    first_name: account.name,
    email: user.email,
  };

  return <DashboardClient profile={profile} stats={stats} account={account} />;
}
