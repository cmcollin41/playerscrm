import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import GenericButton from "@/components/modal-buttons/generic-button";
import CreateTeamModal from "@/components/modal/create-team-modal";
import { TeamTable } from "./table";
import { getAccount } from "@/lib/fetchers/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TeamsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const account = await getAccount();

  const { data: teams, error } = await supabase
    .from("teams")
    .select(`
      *,
      rosters(*, people(*)),
      staff(*, people(name))
    `)
    .eq("account_id", account.id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  const totalTeams = teams?.length || 0;
  const activeTeams = teams?.filter(t => t.is_active).length || 0;
  const inactiveTeams = totalTeams - activeTeams;
  const totalPlayers = teams?.reduce((sum, t) => sum + (t.rosters?.length || 0), 0) || 0;
  const withStaff = teams?.filter(t => t.staff && t.staff.length > 0).length || 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
            <p className="text-muted-foreground">
              Manage your teams, rosters, and staff
            </p>
          </div>
          <GenericButton cta="+ New Team" classNames="">
            <CreateTeamModal account={account} />
          </GenericButton>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTeams}</div>
            <p className="text-xs text-muted-foreground">
              In your organization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTeams}</div>
            <p className="text-xs text-muted-foreground">
              {inactiveTeams} inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPlayers}</div>
            <p className="text-xs text-muted-foreground">
              Across all rosters
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{withStaff}</div>
            <p className="text-xs text-muted-foreground">
              {totalTeams > 0 ? Math.round((withStaff / totalTeams) * 100) : 0}% of teams
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Teams ({totalTeams})</CardTitle>
          <CardDescription>
            Complete list of all teams in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamTable data={teams} account={account} />
        </CardContent>
      </Card>
    </div>
  );
}
