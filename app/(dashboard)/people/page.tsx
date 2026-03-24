import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PeopleTableWrapper } from "./people-table-wrapper";
import { getAccount } from "@/lib/fetchers/server";
import PersonSheet from "@/components/modal/person-sheet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PeoplePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const account = await getAccount();

  // Fetch people server-side via account_people join
  const { data: people, error } = await supabase
    .from("people")
    .select("*, relationships!relationships_person_id_fkey(*), account_people!inner(account_id)")
    .eq("account_people.account_id", account.id);

  if (error) {
    console.error("Error fetching people:", error);
  }

  // Calculate statistics
  const totalPeople = people?.length || 0;
  const dependents = people?.filter(p => p.dependent === true).length || 0;
  const primaryContacts = totalPeople - dependents;
  const withEmail = people?.filter(p => p.email).length || 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">People</h1>
            <p className="text-muted-foreground">
              Manage your athletes, families, and contacts
            </p>
          </div>
          <PersonSheet
            cta="Create Person"
            title="Create New Person"
            description="Add a new person to your account"
            account={account}
            mode="create"
          />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total People</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPeople}</div>
            <p className="text-xs text-muted-foreground">
              In your organization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Primary Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{primaryContacts}</div>
            <p className="text-xs text-muted-foreground">
              Adult contacts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dependents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dependents}</div>
            <p className="text-xs text-muted-foreground">
              Athletes and children
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Email</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{withEmail}</div>
            <p className="text-xs text-muted-foreground">
              {((withEmail / totalPeople) * 100).toFixed(0)}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* People Table */}
      <Card>
        <CardHeader>
          <CardTitle>All People ({totalPeople})</CardTitle>
          <CardDescription>
            Complete list of all people in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PeopleTableWrapper 
            initialPeople={people || []} 
            account={account} 
          />
        </CardContent>
      </Card>
    </div>
  );
}
