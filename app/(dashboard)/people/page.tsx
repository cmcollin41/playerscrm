import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PeopleTableWrapper } from "./people-table-wrapper";
import { getAccount } from "@/lib/fetchers/server";
import PersonSheet from "@/components/modal/person-sheet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/sports-ui";

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
            <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">
              Roster
            </p>
            <h1 className="mt-2 font-display text-4xl leading-tight tracking-tight text-gray-900 sm:text-5xl">
              People
            </h1>
            <p className="mt-1 text-base text-gray-600">
              Manage your athletes, families, and contacts.
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total people"
          value={totalPeople}
          hint="In your organization"
        />
        <StatTile
          label="Primary contacts"
          value={primaryContacts}
          hint="Adult contacts"
        />
        <StatTile
          label="Dependents"
          value={dependents}
          hint="Athletes and children"
        />
        <StatTile
          label="With email"
          value={withEmail}
          hint={`${totalPeople > 0 ? ((withEmail / totalPeople) * 100).toFixed(0) : 0}% of total`}
        />
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
